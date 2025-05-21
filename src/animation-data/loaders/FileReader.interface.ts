/**
 * Represents an item in a directory listing
 */
export interface FileListItem {
    /** Name of the file or directory */
    name: string;
    
    /** Path to the item, relative to the listed directory */
    path: string;
    
    /** Whether this item is a directory */
    isDirectory: boolean;
}

/**
 * Interface for reading files from a data source
 */
export interface FileReader {
    readJSONFile<T>(modelLayoutPath: string): import("..").ModelLayout | PromiseLike<import("..").ModelLayout>;
    /**
     * Reads a file and returns its contents as a string
     * 
     * @param relativePath Path to the file, relative to the root directory
     * @returns Promise resolving to the file contents, or undefined if the file cannot be read
     */
    readFileAsText(relativePath: string): Promise<string | undefined>;
    
    /**
     * Lists the contents of a directory
     * 
     * @param relativePath Path to the directory, relative to the root directory
     * @returns Promise resolving to an array of file/directory items
     */
    listDirectoryContents(relativePath: string): Promise<FileListItem[] | undefined>;
    
    /**
     * Resolves a relative path to a full path
     * 
     * @param relativePath Path relative to the root directory
     * @returns The full path
     */
    resolveFullPath(relativePath: string): string;
}