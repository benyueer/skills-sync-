import { Jimp } from 'jimp';
import path from 'path';

async function createIcon() {
  try {
    const inputPath = path.resolve('public/full-icon-src.png');
    const outputPath = path.resolve('public/app-icon.png');
    
    // 加载原图
    const image = await Jimp.read(inputPath);
    
    // 1. 自动裁剪白色背景
    image.autocrop();
    
    // 2. 调整为正方形并居中
    const size = Math.max(image.bitmap.width, image.bitmap.height);
    const square = new Jimp({ width: size, height: size, color: 0x00000000 });
    square.blit(image, (size - image.bitmap.width) / 2, (size - image.bitmap.height) / 2);
    
    // 3. 应用圆角遮罩
    // Jimp 没有直接的 squircle，我们用一个大半径的圆角矩形
    const radius = size * 0.175; // 标准 macOS 圆角比例
    
    // 创建遮罩
    const mask = new Jimp({ width: size, height: size, color: 0x00000000 });
    // 绘制圆角矩形 (这里简单处理：四个角画圆，中间填满)
    // 实际上更好的办法是直接识别非白颜色区域作为遮罩
    
    // 改进：因为原图背景是纯白，我们直接将纯白转为透明
    square.scan(0, 0, square.bitmap.width, square.bitmap.height, function(x, y, idx) {
      const r = this.bitmap.data[idx + 0];
      const g = this.bitmap.data[idx + 1];
      const b = this.bitmap.data[idx + 2];
      // 如果非常接近白色，设为透明
      if (r > 250 && g > 250 && b > 250) {
        this.bitmap.data[idx + 3] = 0;
      }
    });

    // 4. 再次缩放至 1024x1024
    square.resize({ width: 1024, height: 1024 });
    
    await square.write(outputPath);
    console.log('Icon processed successfully');
  } catch (err) {
    console.error('Failed to process icon:', err);
  }
}

createIcon();
