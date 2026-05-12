import zlib
import struct
import math

def process_icon(input_path, output_path):
    with open(input_path, 'rb') as f:
        signature = f.read(8)
        chunks = []
        while True:
            length_data = f.read(4)
            if not length_data: break
            length = struct.unpack('>I', length_data)[0]
            type = f.read(4)
            data = f.read(length)
            f.read(4) # crc
            chunks.append((type, data))
            if type == b'IEND': break

    ihdr = next(c for c in chunks if c[0] == b'IHDR')[1]
    width, height, bit_depth, color_type, compression, filter_method, interlace = struct.unpack('>IIBBBBB', ihdr)
    
    # color_type 2 is RGB, 6 is RGBA
    if color_type not in [2, 6]:
        print(f"Color type {color_type} not supported.")
        return

    idat_data = b''.join(c[1] for c in chunks if c[0] == b'IDAT')
    decompressed = zlib.decompress(idat_data)
    
    new_data = bytearray()
    source_bpp = 3 if color_type == 2 else 4
    stride_in = width * source_bpp + 1
    
    # Squircle parameters
    n = 4.0 
    r_val = width / 2.0
    center = width / 2.0
    
    for y in range(height):
        row_start = y * stride_in
        new_data.append(0) # Filter type 0
        for x in range(width):
            idx = row_start + 1 + x * source_bpp
            if color_type == 2:
                r, g, b = decompressed[idx:idx+3]
                a = 255
            else:
                r, g, b, a = decompressed[idx:idx+4]
            
            # Normalize coordinates
            nx = (x - center) / r_val
            ny = (y - center) / r_val
            
            # Squircle formula
            if (abs(nx)**n + abs(ny)**n) > 1.02: # Tighter margin
                a = 0
            elif r > 248 and g > 248 and b > 248:
                a = 0
                
            new_data.extend([r, g, b, a])
                
    new_idat = zlib.compress(new_data)
    
    with open(output_path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n')
        def write_chunk(type, data):
            f.write(struct.pack('>I', len(data)))
            f.write(type)
            f.write(data)
            f.write(struct.pack('>I', zlib.crc32(type + data) & 0xffffffff))
            
        write_chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, bit_depth, 6, 0, 0, 0))
        write_chunk(b'IDAT', new_idat)
        write_chunk(b'IEND', b'')

if __name__ == "__main__":
    process_icon('public/full-icon-flat.png', 'public/app-icon.png')
    print("Final Icon Processed")
