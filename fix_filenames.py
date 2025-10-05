import json
import os

def fix_filenames():
    # Read the current JSON file
    with open('personal_collection.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Get all image files in the current directory
    image_files = [f for f in os.listdir('.') if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp', '.gif'))]
    print(f"Found {len(image_files)} image files in directory")
    
    # Create a mapping from old filenames to new filenames
    filename_mapping = {}
    for old_filename in data['images']:
        old_name = old_filename['filename']
        # Convert img1_ to image1_, img2_ to image2_, etc.
        if old_name.startswith('img'):
            # Extract the number and rest of the filename
            parts = old_name.split('_', 1)
            if len(parts) == 2 and parts[0].startswith('img'):
                number = parts[0][3:]  # Remove 'img' to get the number
                rest = parts[1]
                new_name = f"image{number}_{rest}"
                filename_mapping[old_name] = new_name
                print(f"Mapping: {old_name} -> {new_name}")
    
    # Update the JSON data
    updated_count = 0
    for image in data['images']:
        old_filename = image['filename']
        if old_filename in filename_mapping:
            new_filename = filename_mapping[old_filename]
            image['filename'] = new_filename
            # Also update the URL to match
            image['url'] = f"http://localhost:8000/{new_filename}"
            updated_count += 1
    
    # Write the updated JSON back
    with open('personal_collection.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"Updated {updated_count} filenames in personal_collection.json")

if __name__ == "__main__":
    fix_filenames() 