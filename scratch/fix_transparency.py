import zlib
import struct
import os

def process_png(input_path, output_path):
    with open(input_path, 'rb') as f:
        signature = f.read(8)
        if signature != b'\x89PNG\r\n\x1a\n':
            print("Not a valid PNG")
            return

        chunks = []
        while True:
            length_data = f.read(4)
            if not length_data: break
            length = struct.unpack('>I', length_data)[0]
            type = f.read(4)
            data = f.read(length)
            crc = f.read(4)
            chunks.append((type, data))
            if type == b'IEND': break

    # Get IHDR info
    ihdr = next(c for c in chunks if c[0] == b'IHDR')[1]
    width, height, bit_depth, color_type, compression, filter_method, interlace = struct.unpack('>IIBBBBB', ihdr)
    
    if color_type not in [2, 6]:
        print(f"Color type {color_type} not supported.")
        return

    # Decompress IDAT
    idat_data = b''.join(c[1] for c in chunks if c[0] == b'IDAT')
    decompressed = zlib.decompress(idat_data)
    
    # Process rows
    source_bpp = 3 if color_type == 2 else 4
    target_bpp = 4
    stride_in = width * source_bpp + 1
    new_data = bytearray()
    
    for y in range(height):
        row_start = y * stride_in
        filter_byte = decompressed[row_start]
        new_data.append(filter_byte) # Keep filter byte (assuming 0 for simplicity, sips usually gives 0)
        
        for x in range(width):
            idx = row_start + 1 + x * source_bpp
            if color_type == 2:
                r, g, b = decompressed[idx:idx+3]
                a = 255
            else:
                r, g, b, a = decompressed[idx:idx+4]
                
            # If pixel is white, make it transparent
            if r > 248 and g > 248 and b > 248:
                a = 0
                
            new_data.extend([r, g, b, a])
                
    # Update IHDR for RGBA
    new_ihdr = struct.pack('>IIBBBBB', width, height, bit_depth, 6, compression, filter_method, interlace)
    
    # Recompress IDAT
    new_idat_data = zlib.compress(new_data)
    
    # Create new chunks
    new_chunks = []
    for type, data in chunks:
        if type == b'IHDR':
            new_chunks.append((b'IHDR', new_ihdr))
        elif type == b'IDAT':
            if new_idat_data:
                new_chunks.append((b'IDAT', new_idat_data))
                new_idat_data = None
            continue
        else:
            new_chunks.append((type, data))
        
    # Write output
    with open(output_path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n')
        for type, data in new_chunks:
            f.write(struct.pack('>I', len(data)))
            f.write(type)
            f.write(data)
            f.write(struct.pack('>I', zlib.crc32(type + data) & 0xffffffff))

if __name__ == "__main__":
    process_png('public/app-icon-clean.png', 'public/app-icon.png')
    print("Done")
