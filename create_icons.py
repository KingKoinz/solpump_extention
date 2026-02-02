from PIL import Image, ImageDraw, ImageFont

# Create simple gradient icons
sizes = [16, 48, 128]

for size in sizes:
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Gradient background (purple)
    for y in range(size):
        color = (
            int(102 + (118 - 102) * y / size),  # R
            int(126 + (75 - 126) * y / size),   # G
            int(234 + (162 - 234) * y / size),  # B
            255
        )
        draw.rectangle([(0, y), (size, y+1)], fill=color)
    
    # Draw emoji-like symbol
    if size >= 48:
        # Draw slot machine symbols
        draw.ellipse([size//4, size//4, 3*size//4, 3*size//4], 
                    fill=(255, 255, 255, 200), 
                    outline=(255, 255, 255, 255), width=2)
        
        # Draw "7" or graph symbol
        if size >= 128:
            try:
                font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", size//3)
            except:
                font = ImageFont.load_default()
            draw.text((size//2, size//2), "📊", fill=(255, 255, 255, 255), 
                     anchor="mm", font=font)
    
    img.save(f'icon{size}.png')
    print(f"Created icon{size}.png")

print("Icons created successfully!")
