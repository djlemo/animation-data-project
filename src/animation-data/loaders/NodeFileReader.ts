import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as nodePath from 'path';
import { FileReader, FileListItem } from './FileReader.interface';

/**
 * Implementation of FileReader using Node.js filesystem
 */
export class NodeFileReader implements FileReader {
    /** Absolute path to the study root directory */
    private studyRootAbsPath: string;
    
    /**
     * Creates a new NodeFileReader
     * 
     * @param studyRootAbsPath Absolute path to the study root directory
     */
    constructor(studyRootAbsPath: string) {
        this.studyRootAbsPath = nodePath.resolve(studyRootAbsPath);
        
        // Check if the directory exists
        if (!fs.existsSync(this.studyRootAbsPath)) {
            throw new Error(`NodeFileReader: Study root path does not exist: ${this.studyRootAbsPath}`);
        }
    }
    
    /**
     * Resolves a relative path to an absolute path
     */
    resolveFullPath(relativePath: string): string {
        // Remove leading ./ if present
        const cleanPath = relativePath.replace(/^\.\//, '');
        return nodePath.join(this.studyRootAbsPath, cleanPath);
    }
    
    /**
     * Reads a file and returns its contents as a string
     */
    async readFileAsText(relativePath: string): Promise<string | undefined> {
        const fullPath = this.resolveFullPath(relativePath);
        try {
            return await fsPromises.readFile(fullPath, 'utf-8');
        } catch (error: any) {
            console.error(`NodeFileReader Error reading ${fullPath}: ${error.message}`);
            return undefined;
        }
    }
    
    /**
     * Lists the contents of a directory
     */
    async listDirectoryContents(relativePath: string): Promise<FileListItem[] | undefined> {
        const fullPath = this.resolveFullPath(relativePath);
        try {
            const items = await fsPromises.readdir(fullPath, { withFileTypes: true });
            return items.map(item => ({
                name: item.name,
                path: nodePath.join(relativePath, item.name), // Path relative to study root
                isDirectory: item.isDirectory(),
            }));
        } catch (error: any) {
            console.error(`NodeFileReader Error listing ${fullPath}: ${error.message}`);
            return undefined;
        }
    }
}