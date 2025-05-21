import { FileReader } from '../loaders/FileReader.interface';

/**
 * Manages caching of JSON data to avoid redundant file reads and parsing
 */
export class CacheManager {
    /** File reader implementation */
    private reader: FileReader;
    
    /** Cache for loaded JSON files */
    private jsonCache: Map<string, any> = new Map();
    
    /**
     * Creates a new CacheManager instance
     * 
     * @param reader File reader to use for loading data
     */
    constructor(reader: FileReader) {
        this.reader = reader;
    }
    
    /**
     * Fetches and parses a JSON file with caching
     * 
     * @param relativePath Path to the JSON file
     * @returns Parsed JSON object, or undefined if the file couldn't be read or parsed
     */
    public async fetchAndParseJSON<T>(relativePath: string): Promise<T | undefined> {
        // Check cache first
        if (this.jsonCache.has(relativePath)) {
            return this.jsonCache.get(relativePath) as T;
        }
        
        // Not in cache, load and parse
        const content = await this.reader.readFileAsText(relativePath);
        if (content) {
            try {
                const parsed = JSON.parse(content) as T;
                // Store in cache
                this.jsonCache.set(relativePath, parsed);
                return parsed;
            } catch (e) {
                console.error(`CacheManager: Error parsing JSON from path ${relativePath}:`, e);
                return undefined;
            }
        }
        return undefined;
    }
    
    /**
     * Clears the JSON cache
     * 
     * @param path Optional path to clear a specific entry, or clear all if not provided
     */
    public clearCache(path?: string): void {
        if (path) {
            this.jsonCache.delete(path);
        } else {
            this.jsonCache.clear();
        }
    }
    
    /**
     * Gets the current cache size
     * 
     * @returns Number of items in the cache
     */
    public getCacheSize(): number {
        return this.jsonCache.size;
    }
}
