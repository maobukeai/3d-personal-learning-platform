export interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children: TreeNode[];
}

export interface FlattenedNode {
  name: string;
  path: string;
  isFolder: boolean;
  level: number;
}

/**
 * Parses the filenames inside a ZIP file using standard central directory parsing.
 * This runs client-side inside the browser using FileReader.
 */
export function parseZipFileNames(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const EOCD_MAX_SIZE = 65535 + 22;
    const sliceStart = Math.max(0, file.size - EOCD_MAX_SIZE);
    const blob = file.slice(sliceStart);
    
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        if (!buffer) {
          resolve([]);
          return;
        }
        
        const view = new DataView(buffer);
        let eocdOffset = -1;
        
        for (let i = buffer.byteLength - 22; i >= 0; i--) {
          if (view.getUint32(i, true) === 0x06054b50) {
            eocdOffset = i;
            break;
          }
        }
        
        if (eocdOffset === -1) {
          resolve([]);
          return;
        }
        
        const numRecords = view.getUint16(eocdOffset + 10, true);
        const cdSize = view.getUint32(eocdOffset + 12, true);
        const cdOffset = view.getUint32(eocdOffset + 16, true);
        
        const cdReader = new FileReader();
        const cdBlob = file.slice(cdOffset, cdOffset + cdSize);
        
        cdReader.onload = (cdEvent) => {
          try {
            const cdBuffer = cdEvent.target?.result as ArrayBuffer;
            if (!cdBuffer) {
              resolve([]);
              return;
            }
            
            const cdView = new DataView(cdBuffer);
            const fileNames: string[] = [];
            let offset = 0;
            const decoder = new TextDecoder('utf-8');
            
            for (let r = 0; r < numRecords; r++) {
              if (offset + 46 > cdBuffer.byteLength) break;
              
              const sig = cdView.getUint32(offset, true);
              if (sig !== 0x02014b50) {
                break;
              }
              
              const nameLen = cdView.getUint16(offset + 28, true);
              const extraLen = cdView.getUint16(offset + 30, true);
              const commentLen = cdView.getUint16(offset + 32, true);
              
              if (offset + 46 + nameLen > cdBuffer.byteLength) break;
              
              const nameBytes = new Uint8Array(cdBuffer, offset + 46, nameLen);
              const fileName = decoder.decode(nameBytes);
              
              if (fileName && !fileName.endsWith('/')) {
                fileNames.push(fileName);
              }
              
              offset += 46 + nameLen + extraLen + commentLen;
            }
            
            resolve(fileNames);
          } catch (err) {
            reject(err);
          }
        };
        
        cdReader.onerror = () => reject(cdReader.error);
        cdReader.readAsArrayBuffer(cdBlob);
      } catch (err) {
        reject(err);
      }
    };
    
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Builds a hierarchical tree structure from a list of relative file paths.
 */
export function buildFileTree(files: string[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const filePath of files) {
    const parts = filePath.split('/');
    let currentLevel = root;
    let accumulatedPath = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;
      const isLast = i === parts.length - 1;
      let existingNode = currentLevel.find(node => node.name === part);
      if (!existingNode) {
        existingNode = {
          name: part,
          path: accumulatedPath,
          isFolder: !isLast,
          children: []
        };
        currentLevel.push(existingNode);
        currentLevel.sort((a, b) => {
          if (a.isFolder !== b.isFolder) {
            return a.isFolder ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
      }
      currentLevel = existingNode.children;
    }
  }
  return root;
}

/**
 * Flattens a TreeNode hierarchy into a flat list, calculating the depth level for rendering indents.
 */
export function flattenFileTree(nodes: TreeNode[], level = 0): FlattenedNode[] {
  const result: FlattenedNode[] = [];
  for (const node of nodes) {
    result.push({
      name: node.name,
      path: node.path,
      isFolder: node.isFolder,
      level
    });
    if (node.isFolder && node.children.length > 0) {
      result.push(...flattenFileTree(node.children, level + 1));
    }
  }
  return result;
}
