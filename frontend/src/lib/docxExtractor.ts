
import JSZip from "jszip";

/**
 * Extracts formatted text, sections, and tables from a Word (.docx) document in the browser.
 * Uses native JSZip and DOMParser to parse word/document.xml.
 */
export async function extractDocxTextAndTables(file: File): Promise<string> {
  try {
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(file);

    const docXmlFile = loadedZip.file("word/document.xml");
    if (!docXmlFile) {
      return `File: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    }

    const docXmlText = await docXmlFile.async("text");
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(docXmlText, "application/xml");

    const body = xmlDoc.getElementsByTagName("w:body")[0];
    if (!body) {
      return `File: ${file.name}`;
    }

    let output = "";

    // Traverse body children in document order
    for (const node of Array.from(body.children)) {
      if (node.tagName === "w:p") {
        // Extract paragraph text
        const text = node.textContent?.trim();
        if (text) {
          output += `${text}\n`;
        }
      } else if (node.tagName === "w:tbl") {
        // Extract structured table
        output += "\n--- TABLE START ---\n";
        const rows = node.getElementsByTagName("w:tr");

        for (let r = 0; r < rows.length; r++) {
          const cells = rows[r].getElementsByTagName("w:tc");
          const cellTexts: string[] = [];

          for (let c = 0; c < cells.length; c++) {
            // Trim whitespace inside cell
            const cellText = cells[c].textContent?.trim() || "";
            cellTexts.push(cellText);
          }

          if (cellTexts.some((t) => t.length > 0)) {
            output += `Row ${r + 1}: ${cellTexts.join(" | ")}\n`;
          }
        }
        output += "--- TABLE END ---\n\n";
      }
    }

    return output.trim() || `File: ${file.name}`;
  } catch (err) {
    console.warn("Error parsing .docx file:", err);
    return `File: ${file.name}, Size: ${(file.size / 1024).toFixed(1)} KB`;
  }
}
