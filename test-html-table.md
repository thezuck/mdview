# Enhanced Table Features Test

## Feature Overview

This markdown viewer includes powerful table enhancement features:
- **Column Resizing**: Drag the right edge of column headers
- **Column Hiding**: Click the 👁️ button in column headers to hide; a **▼ dropdown arrow** appears on adjacent columns to restore
- **Sorting**: Click the ⇅ button to sort by that column
- **Row Height**: Drag the bottom edge of any row to adjust its height
- **Word Wrapping**: Long URLs and words will wrap/break as needed
- **Color Hints**: Use `[#ff0000]` to color text that follows (works in tables and lists)

---

## Color Hints Examples

### In Bullet Lists

- This is normal text
- [#ff0000] This text should be red
- [#00ff00] This text should be green
- [#0000ff] This text should be blue
- [#ff00ff] Magenta text [#ffff00] followed by yellow text
- Regular text with [#ff6600] orange highlight in the middle

### In Tables

| Status | Description | Notes |
|--------|-------------|-------|
| Active | [#00ff00] This item is currently active | Normal text |
| Warning | [#ffa500] Needs attention soon | Should see orange |
| Error | [#ff0000] Critical issue requiring immediate action | Red alert |
| Info | [#0088ff] General information | Blue text |
| Success | [#00cc00] Operation completed successfully | Green |

---

## Premium Oven Specifications

| # | Model | Maker | # of Websites | Website | Price | Color | Warranty Provider | Link | Model Information |
|---|-------|-------|---------------|---------|-------|-------|-------------------|------|-------------------|
| 1 | CUISINE-7600B | Sauter | 1 | https://example.com | $2,499 | Silver | WarrantyCo | [Link](https://example.com) | • [#667eea] Premium CHEF EDITION series<br>• 77L capacity with pyrolytic self-cleaning<br>• [#ff0000] Heats to 480°C for automatic fat burning<br>• 19 preset cooking programs<br>• SmallCatalyst: prevents burned odors<br>• Cool Door: max 43°C safety system<br>• [#00cc00] Quick preheat to 150°C in 3 minutes<br>• Turbo Active for multi-tray baking<br>• 3D convection for even heat<br>• 4-layer tempered glass door<br>• Digital timer with LED display<br>• Halogen interior lighting<br>• [#0088ff] Power: 5600W<br>• Energy rating: A+<br>• Temp range: 50-280°C<br>• Telescopic rails with auto-stops<br>• Non-stick baking trays included |
| 2 | CUISINE-8800X | Bosch | 2 | https://bosch.com | $3,299 | Black | BoschCare | [Link](https://bosch.com) | • Professional MASTER series<br>• 90L extra-large capacity<br>• Heats to 500°C<br>• 25 preset programs<br>• Steam cleaning function<br>• TouchScreen control panel |

---

## Sample Products Table

| Product ID | Product Name | Category | Price | Stock | Rating | Description |
|------------|--------------|----------|-------|-------|--------|-------------|
| 101 | Laptop Pro 15" | Electronics | $1,299.99 | 45 | 4.8 | High-performance laptop with:<br>• Intel Core i7<br>• 16GB RAM<br>• 512GB SSD<br>• [#0088ff] 15.6" Display |
| 102 | Wireless Mouse | Accessories | $29.99 | 230 | 4.5 | Ergonomic design<br>2.4GHz wireless<br>1600 DPI |
| 103 | USB-C Hub | Accessories | $49.99 | 87 | 4.7 | 7-in-1 hub with multiple ports |
| 104 | Gaming Keyboard | Electronics | $159.99 | 12 | 4.9 | [#ff00ff] Mechanical switches<br>RGB lighting<br>Programmable keys |
| 105 | Monitor 27" 4K | Electronics | $449.99 | 34 | 4.6 | [#00cc00] Ultra HD display<br>HDR support<br>144Hz refresh |

---

## Testing Word Wrap with Long Content

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Short | https://www.example.com/very/long/path/to/some/resource/that/should/wrap/automatically/when/column/is/narrow/testing/url/wrapping | supercalifragilisticexpialidocious pneumonoultramicroscopicsilicovolcanoconiosis |
| Normal text | This is normal text that should wrap naturally at word boundaries when the column becomes narrow | More regular content here |
| Code test | <code>verylongfunctionnamewithoutbreaks(parameter1, parameter2, parameter3)</code> | `console.log('test')` |

---

## Instructions

### Color Hints
- Use the format `[#RRGGBB]` or `[#RGB]` anywhere in your text
- The hint will be removed and the text that follows will be colored
- Works in tables, lists, and regular paragraphs
- Multiple color hints can be used in the same line
- The color applies until the next color hint or end of line/bullet

### Column Operations
1. **Resize columns**: Hover over the right edge of any header until you see the resize cursor, then drag
2. **Hide columns**: Click the 👁️ button in the header
3. **Restore hidden columns**: When you hide a column, a **▼ dropdown arrow** appears above the adjacent visible column - click it to restore
4. **Sort data**: Click the ⇅ button to sort ascending, click again for descending

**Note**: The restore arrow appears:
- On the **left side** of the column to the right of the hidden column
- On the **right side** of the column to the left if hiding the rightmost column

### Row Operations
1. **Adjust row height**: Hover over the bottom edge of any table row until you see the resize cursor
2. **Drag down** to increase height or **drag up** to decrease height
3. After resizing, a popup will appear asking if you want to apply the same height to all rows
4. The popup will auto-dismiss after 5 seconds if you don't respond

### Features to Try
- Make columns very narrow to see word wrapping in action
- Hide multiple columns and then show them again
- Sort by different columns (numeric vs alphabetic)
- Set different heights for individual rows
- Combine all features: narrow columns + custom row heights + hidden columns

