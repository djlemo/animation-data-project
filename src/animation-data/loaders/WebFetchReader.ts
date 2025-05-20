import { FileReader, FileListItem } from './FileReader.interface';

/**
 * Implementation of FileReader using browser fetch API
 */
export class WebFetchReader implements FileReader {
    private baseUrl: string;
    
    /**
     * Creates a new WebFetchReader
     * @param baseUrl Base URL for all file requests (e.g., 'https://example.com/data/')
     */
    constructor(baseUrl: string) {
        // Ensure baseUrl ends with a slash
        this.baseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
    }
    
    /**
     * Resolves a relative path to a full URL
     * @param relativePath Path relative to the base URL
     * @returns Full URL for the resource
     */
    resolveFullPath(relativePath: string): string {
        // Remove leading ./ if present
        const cleanPath = relativePath.replace(/^\.\//, '');
        return this.baseUrl + cleanPath;
    }
    
    /**
     * Reads a file and returns its contents as a string
     * @param relativePath Path to the file, relative to the base URL
     * @returns Promise resolving to the file contents, or undefined if the file couldn't be read
     */
    async readFileAsText(relativePath: string): Promise<string | undefined> {
        const url = this.resolveFullPath(relativePath);
        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.error(`WebFetchReader Error: ${response.status} ${response.statusText} - ${url}`);
                return undefined;
            }
            return await response.text();
        } catch (error: any) {
            console.error(`WebFetchReader Error reading ${url}: ${error.message}`);
            return undefined;
        }
    }
    
    /**
     * Lists the contents of a directory
     * @param relativePath Path to the directory, relative to the base URL
     * @returns Promise resolving to an array of file/directory items, or undefined if the directory couldn't be listed
     * 
     * @note This requires server-side support to list directory contents. For web deployment,
     * you might use a manifest file or API endpoint that returns directory contents in the expected format.
     */
    async listDirectoryContents(relativePath: string): Promise<FileListItem[] | undefined> {
        // This requires server-side support to list directory contents
        // For web deployment, you might use a manifest file or API endpoint instead
        const url = this.resolveFullPath(relativePath + '/directory-contents.json');
        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.error(`WebFetchReader Error: ${response.status} ${response.statusText} - ${url}`);
                return undefined;
            }
            return await response.json();
        } catch (error: any) {
            console.error(`WebFetchReader Error listing ${url}: ${error.message}`);
            return undefined;
        }
    }
}
