// Export all interfaces from their respective files
export * from './interfaces/manifest.types';
export * from './interfaces/modelLayout.types';
export * from './interfaces/visualConfig.types';

// Export with renamed interfaces to avoid conflicts
export { BasicEntityPath, EntityPathBatch } from './interfaces/entity.types';
export * from './interfaces/entityPath.types';
export * from './interfaces/statistics.types';

// Export the main AnimationData class
export { AnimationData } from './AnimationData';