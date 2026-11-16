import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

class ModelCacheManager {
  private loader = new GLTFLoader();
  private cache = new Map<string, Promise<GLTF>>();

  loadGLTF(url: string, onProgress?: (event: ProgressEvent) => void): Promise<GLTF> {
    let cachedPromise = this.cache.get(url);
    if (!cachedPromise) {
      cachedPromise = new Promise<GLTF>((resolve, reject) => {
        this.loader.load(url, resolve, onProgress, reject);
      });
      this.cache.set(url, cachedPromise);
    }
    return cachedPromise;
  }

  async cloneModel(url: string, onProgress?: (event: ProgressEvent) => void): Promise<THREE.Group> {
    const gltf = await this.loadGLTF(url, onProgress);
    return SkeletonUtils.clone(gltf.scene) as THREE.Group;
  }

  has(url: string): boolean {
    return this.cache.has(url);
  }
}

export const modelCache = new ModelCacheManager();
