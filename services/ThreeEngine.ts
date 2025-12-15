import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';
import { AppState, HandData, InputMode } from '../types';
import { CONFIG } from '../constants';

export class ThreeEngine {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private raycaster: THREE.Raycaster;
  
  // Objects
  private particlesSystem!: THREE.Points;
  private decorationSystem!: THREE.Points;
  private snowSystem!: THREE.Points;
  private photoGroup!: THREE.Group;
  private heartMesh!: THREE.Points;
  private signatureMesh!: THREE.Mesh;
  private loveTextMesh!: THREE.Mesh;
  private carouselTextMesh!: THREE.Mesh;
  
  private photos: THREE.Mesh[] = [];
  private zoomedPhoto: THREE.Mesh | null = null;
  
  // State
  private currentState: AppState = AppState.INTRO;
  private targetState: AppState = AppState.TREE;
  private inputMode: InputMode = InputMode.MOUSE;
  private mouse = new THREE.Vector2();
  
  // Logic vars
  private animationId: number = 0;
  private lastQuoteTime: number = 0;
  private isQuoteFading: boolean = false;
  private currentQuoteIndex: number = 0;
  private lastFlashTime: number = 0;
  private currentFlashIndex: number = 0;
  private shuffledIndices: number[] = [];
  private currentVisiblePhoto: THREE.Mesh | null = null;
  
  // Hand tracking
  private handData: HandData = { 
    present: false, x: 0.5, y: 0.5, isPinching: false, isFist: false, isHeartGesture: false 
  };

  private stateChangeCallback?: (state: AppState) => void;

  constructor(container: HTMLElement, onStateChange?: (state: AppState) => void) {
    this.container = container;
    this.stateChangeCallback = onStateChange;
    
    // Init Three
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x050510, 0.02);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 0, 45);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);

    this.raycaster = new THREE.Raycaster();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffd700, 1, 100);
    pointLight.position.set(0, 10, 10);
    this.scene.add(pointLight);

    // Initial Object Creation
    this.createParticles();
    this.createTreeDecorations();
    this.createSnow();
    this.createHeart();
    this.createSignature();
    this.createLoveText();
    this.createCarouselText(CONFIG.loveQuotes[0]);
    
    // Placeholder photos until loaded
    this.createPhotos(Array.from({ length: CONFIG.photoCount }, (_, i) => CONFIG.defaultPhotoUrl(i)));

    window.addEventListener('resize', this.onWindowResize.bind(this));
    
    // Start loop
    this.animate();
  }

  public setMode(mode: InputMode) {
    this.inputMode = mode;
    this.transitionTo(AppState.TREE);
  }

  public updateHand(data: HandData) {
    this.handData = data;
    // Map hand data to mouse for unified logic where possible
    if (this.inputMode === InputMode.CAMERA && data.present) {
        // Convert normalized 0-1 to screen coords then to clip space for raycaster
        this.mouse.x = (data.x * 2) - 1;
        this.mouse.y = -(data.y * 2) + 1;
    }
  }

  public updateMouse(x: number, y: number, isDown: boolean) {
    if (this.inputMode === InputMode.MOUSE) {
        this.mouse.x = (x / window.innerWidth) * 2 - 1;
        this.mouse.y = -(y / window.innerHeight) * 2 + 1;
        
        // Simulate hand data for mouse
        this.handData.present = true;
        this.handData.x = x / window.innerWidth;
        this.handData.y = y / window.innerHeight;
        // In mouse mode, click acts as pinch
        this.handData.isPinching = isDown && this.currentState === AppState.EXPLODE;
        // Long press logic handled in App.tsx or interpreted here? 
        // For simplicity, we assume App.tsx passes explicit "isFist" if mouse is held long enough
        // But let's just use the isDown for basic interaction.
    }
  }

  public setFistGesture(isFist: boolean) {
    if (this.inputMode === InputMode.MOUSE) {
        this.handData.isFist = isFist;
    }
  }

  public loadUserPhotos(urls: string[]) {
    // Recreate photos
    if (this.photoGroup) {
      this.scene.remove(this.photoGroup);
      this.photos.forEach(p => {
          (p.geometry as THREE.BufferGeometry).dispose();
          if (Array.isArray(p.material)) {
              p.material.forEach(m => m.dispose());
          } else {
             (p.material as THREE.Material).dispose();
          }
      });
      this.photos = [];
    }
    this.createPhotos(urls);
  }

  private createPhotos(urls: string[]) {
    this.photoGroup = new THREE.Group();
    const loader = new THREE.TextureLoader();
    const geometry = new THREE.PlaneGeometry(4, 4);

    urls.forEach((url, i) => {
        loader.load(url, (texture) => {
            const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true, opacity: 0 });
            const photo = new THREE.Mesh(geometry, material);
            photo.position.set((Math.random()-0.5)*50, (Math.random()-0.5)*50, (Math.random()-0.5)*50);
            photo.userData = {
                id: i,
                velocity: new THREE.Vector3((Math.random()-0.5)*0.02, (Math.random()-0.5)*0.02, (Math.random()-0.5)*0.02)
            };
            this.photos.push(photo);
            this.photoGroup.add(photo);
        });
    });
    this.scene.add(this.photoGroup);
  }

  private createParticles() {
    const geometry = new THREE.BufferGeometry();
    const positions = [], colors = [], sizes = [], targetPositions = [];
    const colorObj = new THREE.Color();
    
    for (let i = 0; i < CONFIG.particleCount; i++) {
        const x = (Math.random() - 0.5) * 100;
        const y = (Math.random() - 0.5) * 100;
        const z = (Math.random() - 0.5) * 100;
        positions.push(x, y, z);
        const hex = CONFIG.colors[Math.floor(Math.random() * CONFIG.colors.length)];
        colorObj.setHex(hex);
        colors.push(colorObj.r, colorObj.g, colorObj.b);
        sizes.push(Math.random() * 0.5);
        targetPositions.push(x, y, z);
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    const material = new THREE.PointsMaterial({ size: 0.8, vertexColors: true, map: this.createCircleTexture(), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
    this.particlesSystem = new THREE.Points(geometry, material);
    this.particlesSystem.userData = { targets: targetPositions, count: CONFIG.particleCount };
    this.scene.add(this.particlesSystem);
  }

  private createTreeDecorations() {
    const geometry = new THREE.BufferGeometry();
    const positions = [], colors = [], sizes = [], targetPositions = [];
    const colorObj = new THREE.Color();
    const decoCount = 300;
    for (let i = 0; i < decoCount; i++) {
        const x = (Math.random() - 0.5) * 100;
        const y = (Math.random() - 0.5) * 100;
        const z = (Math.random() - 0.5) * 100;
        positions.push(x, y, z);
        targetPositions.push(x, y, z);
        const hex = CONFIG.decoColors[Math.floor(Math.random() * CONFIG.decoColors.length)];
        colorObj.setHex(hex);
        colors.push(colorObj.r, colorObj.g, colorObj.b);
        sizes.push(Math.random() * 0.8 + 0.4);
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    const material = new THREE.PointsMaterial({ size: 1.0, vertexColors: true, map: this.createCircleTexture(), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    this.decorationSystem = new THREE.Points(geometry, material);
    this.decorationSystem.userData = { targets: targetPositions, count: decoCount };
    this.scene.add(this.decorationSystem);
  }

  private createSnow() {
    const geometry = new THREE.BufferGeometry();
    const positions = [], velocities = [];
    for (let i = 0; i < CONFIG.snowCount; i++) {
        positions.push((Math.random() - 0.5) * 100, Math.random() * 100, (Math.random() - 0.5) * 100);
        velocities.push((Math.random() - 0.5) * 0.1, -(Math.random() * 0.2 + 0.1), (Math.random() - 0.5) * 0.1);
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.Float32BufferAttribute(velocities, 3));
    const material = new THREE.PointsMaterial({ size: 0.5, color: 0xffffff, map: this.createCircleTexture(), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
    this.snowSystem = new THREE.Points(geometry, material);
    this.scene.add(this.snowSystem);
  }

  private createHeart() {
    const geometry = new THREE.BufferGeometry();
    const positions = [], colors = [], sizes = [];
    const count = 2500;
    for (let i = 0; i < count; i++) {
        const t = Math.random() * Math.PI * 2;
        let hx = 16 * Math.pow(Math.sin(t), 3);
        let hy = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
        const scale = Math.sqrt(Math.random());
        const s = 0.12;
        const x = hx * scale * s;
        const y = hy * scale * s;
        const z = (Math.random() - 0.5) * 2.0;
        positions.push(x, y, z);
        colors.push(1.0, 0.0, 0.3 + Math.random() * 0.2);
        sizes.push(Math.random() * 0.4 + 0.4);
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    const material = new THREE.PointsMaterial({ size: 0.6, vertexColors: true, map: this.createCircleTexture(), transparent: true, opacity: 1.0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.heartMesh = new THREE.Points(geometry, material);
    this.heartMesh.position.set(0, CONFIG.treeHeight / 2, 0);
    const heartLight = new THREE.PointLight(0xff0055, 2, 10);
    this.heartMesh.add(heartLight);
    this.scene.add(this.heartMesh);
  }

  private createSignature() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = 1024; canvas.height = 256;
    ctx.font = '100px "Great Vibes", cursive';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255, 215, 0, 1)'; ctx.shadowBlur = 20;
    ctx.fillText('JL ❤ WRQ', canvas.width / 2, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 1, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    this.signatureMesh = new THREE.Mesh(new THREE.PlaneGeometry(20, 5), material);
    this.signatureMesh.position.set(0, -CONFIG.treeHeight / 2 - 5, 5);
    this.scene.add(this.signatureMesh);
  }

  private createLoveText() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = 1024; canvas.height = 512;
    ctx.font = '100px "Ma Shan Zheng", cursive';
    ctx.fillStyle = '#ff3366';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255, 50, 100, 0.8)'; ctx.shadowBlur = 30;
    ctx.fillText('金龙王瑞琪', canvas.width / 2, canvas.height / 2 - 70);
    ctx.fillText('一直一直在一起', canvas.width / 2, canvas.height / 2 + 70);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    this.loveTextMesh = new THREE.Mesh(new THREE.PlaneGeometry(30, 15), material);
    this.loveTextMesh.position.set(0, 0, 10);
    this.scene.add(this.loveTextMesh);
  }

  private createCarouselText(text: string) {
    if (this.carouselTextMesh) {
        this.scene.remove(this.carouselTextMesh);
        (this.carouselTextMesh.material as THREE.MeshBasicMaterial).map?.dispose();
        (this.carouselTextMesh.material as THREE.Material).dispose();
        this.carouselTextMesh.geometry.dispose();
    }
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = 1024; canvas.height = 256;
    ctx.font = '80px "Ma Shan Zheng", cursive';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255, 20, 147, 0.8)'; ctx.shadowBlur = 25;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    this.carouselTextMesh = new THREE.Mesh(new THREE.PlaneGeometry(25, 6), material);
    this.carouselTextMesh.position.set(0, 15, 0);
    this.scene.add(this.carouselTextMesh);
  }

  private createCircleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.5)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(canvas);
  }

  // --- Animation Logic ---

  private calculateTargets(mode: AppState, count: number, isDecoration = false) {
    const targets = [];
    const time = Date.now() * 0.001;
    const isTreeForm = (mode === AppState.TREE || mode === AppState.INTRO);

    if (isTreeForm) {
        for (let i = 0; i < count; i++) {
            const angleOffset = isDecoration ? i * 0.5 : i * 0.1;
            const angle = angleOffset + time * (isDecoration ? 0.5 : 1);
            let h = (i / count) * CONFIG.treeHeight;
            let r = (1 - h / CONFIG.treeHeight) * CONFIG.treeRadius;
            if (isDecoration) {
                h = Math.random() * CONFIG.treeHeight;
                r = (1 - h / CONFIG.treeHeight) * CONFIG.treeRadius * (0.8 + Math.random() * 0.4);
            }
            const x = Math.cos(angle * 5) * r;
            const y = h - CONFIG.treeHeight / 2;
            const z = Math.sin(angle * 5) * r;
            targets.push(x, y, z);
        }
    } else if (mode === AppState.CAROUSEL) {
         for (let i = 0; i < count; i++) {
            const angle = i * 0.2 + time * 0.2; 
            const h = (i / count) * 40 - 20; 
            const r = 15; 
            const x = Math.cos(angle) * r;
            const y = h;
            const z = Math.sin(angle) * r;
            targets.push(x, y, z);
        }
    }
    return targets;
  }

  private updateParticles(system: THREE.Points, isDecoration: boolean) {
    const positions = system.geometry.attributes.position.array as Float32Array;
    const count = system.userData.count;
    const targets = this.calculateTargets(this.currentState, count, isDecoration);
    const lerpSpeed = (this.currentState === AppState.TREE || this.currentState === AppState.INTRO) ? (isDecoration ? 0.08 : 0.1) : 0.02;
    
    for (let i = 0; i < count; i++) {
        const ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;
        if ((this.currentState === AppState.TREE || this.currentState === AppState.INTRO) && targets.length > 0) {
            positions[ix] += (targets[ix] - positions[ix]) * lerpSpeed;
            positions[iy] += (targets[iy] - positions[iy]) * lerpSpeed;
            positions[iz] += (targets[iz] - positions[iz]) * lerpSpeed;
        } else if (this.currentState === AppState.EXPLODE || this.currentState === AppState.HEART_MOMENT) {
            positions[ix] += (Math.random() - 0.5) * 0.1;
            positions[iy] += (Math.random() - 0.5) * 0.1;
            positions[iz] += (Math.random() - 0.5) * 0.1;
            if(Math.abs(positions[ix]) > 60) positions[ix] *= 0.95;
            if(Math.abs(positions[iy]) > 60) positions[iy] *= 0.95;
            if(Math.abs(positions[iz]) > 60) positions[iz] *= 0.95;
        } else if (this.currentState === AppState.CAROUSEL && targets.length > 0) {
            positions[ix] += (targets[ix] - positions[ix]) * 0.05;
            positions[iy] += (targets[iy] - positions[iy]) * 0.05;
            positions[iz] += (targets[iz] - positions[iz]) * 0.05;
        }
    }
    system.geometry.attributes.position.needsUpdate = true;
    if (this.currentState === AppState.TREE || this.currentState === AppState.INTRO) {
        system.rotation.y += isDecoration ? 0.003 : 0.005;
    } else if (this.currentState === AppState.CAROUSEL) {
        system.rotation.y += 0.002;
    }
  }

  private transitionTo(newState: AppState) {
    if (this.currentState === newState) return;
    
    if (this.zoomedPhoto) {
        new TWEEN.Tween(this.zoomedPhoto.scale).to({ x: 1, y: 1, z: 1 }, 300).start();
        this.zoomedPhoto = null;
    }

    // Specific state cleanup/setup
    if (newState === AppState.TREE) {
        if(this.heartMesh) new TWEEN.Tween(this.heartMesh.scale).to({x:2, y:2, z:2}, 1000).easing(TWEEN.Easing.Elastic.Out).start();
        if(this.signatureMesh) new TWEEN.Tween(this.signatureMesh.material).to({opacity: 1}, 1000).start();
        this.photos.forEach(p => new TWEEN.Tween(p.material).to({ opacity: 0 }, 1000).start());
        new TWEEN.Tween(this.camera.position).to({ x: 0, y: 0, z: 45 }, 1500).onUpdate(() => this.camera.lookAt(0,0,0)).start();
    } else {
        if(this.heartMesh) new TWEEN.Tween(this.heartMesh.scale).to({x:0.01, y:0.01, z:0.01}, 500).start();
        if(this.signatureMesh) new TWEEN.Tween(this.signatureMesh.material).to({opacity: 0}, 500).start();
    }

    if (newState === AppState.EXPLODE) {
        new TWEEN.Tween(this.photoGroup.rotation).to({y: 0}, 1000).start();
        new TWEEN.Tween(this.photoGroup.scale).to({x: 1, y: 1, z: 1}, 1000).start();
        
        this.photos.forEach(p => {
            const r = CONFIG.explodeRadius * (0.5 + Math.random());
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const tx = r * Math.sin(phi) * Math.cos(theta);
            const ty = r * Math.sin(phi) * Math.sin(theta);
            const tz = r * Math.cos(phi);
            new TWEEN.Tween(p.position).to({ x: tx, y: ty, z: tz }, 1500).easing(TWEEN.Easing.Elastic.Out).start();
            new TWEEN.Tween(p.rotation).to({ x: Math.random(), y: Math.random() }, 1500).start();
            new TWEEN.Tween(p.material).to({ opacity: 1 }, 1000).start();
            p.scale.set(1, 1, 1);
        });
        new TWEEN.Tween(this.camera.position).to({ x: 0, y: 0, z: 45 }, 1000).start();
    } else if (newState === AppState.CAROUSEL) {
        new TWEEN.Tween(this.photoGroup.scale).to({x: 1, y: 1, z: 1}, 1000).start();
        this.photos.forEach((p, i) => {
            const angle = i * 0.5;
            const h = (i / CONFIG.photoCount) * 40 - 20;
            const r = 15;
            const tx = Math.cos(angle) * r;
            const ty = h;
            const tz = Math.sin(angle) * r;
            new TWEEN.Tween(p.position).to({ x: tx, y: ty, z: tz }, 1000).easing(TWEEN.Easing.Quadratic.Out).start();
            p.lookAt(0, h, 0);
            p.rotation.y += Math.PI;
            new TWEEN.Tween(p.material).to({ opacity: 1 }, 1000).start();
        });
        new TWEEN.Tween(this.camera.position).to({ x: 0, y: 0, z: 35 }, 1500).onUpdate(() => this.camera.lookAt(0,0,0)).start();
        this.lastQuoteTime = Date.now();
        this.currentQuoteIndex = 0;
        this.createCarouselText(CONFIG.loveQuotes[0]);
    } else if (newState === AppState.HEART_MOMENT) {
        this.photos.forEach(p => new TWEEN.Tween(p.material).to({ opacity: 0 }, 300).start());
        this.shuffledIndices = [];
        this.currentFlashIndex = 0;
    }

    this.currentState = newState;
    if (this.stateChangeCallback) this.stateChangeCallback(newState);
  }

  private updateStateLogic() {
    if (this.currentState === AppState.INTRO) return;

    if (this.currentState === AppState.CAROUSEL) {
        if (this.handData.isFist) {
            this.targetState = AppState.TREE;
        }
    } else {
        if (this.handData.isHeartGesture) {
            this.targetState = AppState.HEART_MOMENT;
        } else if (this.handData.present) {
            if (this.handData.isPinching && this.zoomedPhoto) return;

            if (this.handData.isFist) {
                this.targetState = AppState.TREE;
            } else if (this.handData.present) { // Hand is open or pointing
                if (this.handData.y < 0.4) {
                    this.targetState = AppState.CAROUSEL;
                } else {
                    this.targetState = AppState.EXPLODE;
                }
            }
        }
    }

    if (this.targetState !== this.currentState) {
        this.transitionTo(this.targetState);
    }
  }

  private animate() {
    this.animationId = requestAnimationFrame(this.animate.bind(this));
    TWEEN.update();

    if (this.inputMode !== null) {
        this.updateStateLogic();
        if (this.currentState === AppState.EXPLODE) {
            this.updateCursorInteraction();
        }
        if (this.currentState === AppState.HEART_MOMENT) {
            this.updateHeartMomentPhotos();
        }
        if (this.currentState === AppState.CAROUSEL) {
            this.updateCarouselTextLoop();
            this.photoGroup.rotation.y += 0.003;
        }
    }

    if (this.currentState === AppState.EXPLODE && this.handData.present && !this.handData.isPinching && !this.zoomedPhoto) {
         // Rotate group based on hand X
         const rotationSpeed = (0.5 - this.handData.x) * 0.03;
         if (Math.abs(this.handData.x - 0.5) > 0.1) {
             this.photoGroup.rotation.y += rotationSpeed;
         }
    }

    // Snow update
    const snowPositions = this.snowSystem.geometry.attributes.position.array as Float32Array;
    const snowVelocities = this.snowSystem.geometry.attributes.velocity.array as Float32Array;
    for (let i = 0; i < CONFIG.snowCount; i++) {
        const ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;
        snowPositions[ix] += snowVelocities[ix];
        snowPositions[iy] += snowVelocities[iy];
        snowPositions[iz] += snowVelocities[iz];
        if (snowPositions[iy] < -50) {
            snowPositions[iy] = 50;
            snowPositions[ix] = (Math.random() - 0.5) * 100;
            snowPositions[iz] = (Math.random() - 0.5) * 100;
        }
    }
    this.snowSystem.geometry.attributes.position.needsUpdate = true;
    this.snowSystem.rotation.y += 0.001;

    // Decorations
    const time = Date.now() * 0.002;
    if (this.currentState === AppState.TREE || this.currentState === AppState.INTRO) {
        if (this.heartMesh) {
            const scale = 2 + Math.sin(time * 2) * 0.1;
            this.heartMesh.scale.set(scale, scale, scale);
            this.heartMesh.rotation.y = Math.sin(time) * 0.3;
        }
        if (this.signatureMesh) {
            this.signatureMesh.position.y = -CONFIG.treeHeight / 2 - 5 + Math.sin(time) * 0.5;
        }
    }
    
    // Love text and carousel text fade in/out
    if (this.loveTextMesh) {
        const targetOpacity = (this.currentState === AppState.HEART_MOMENT) ? 1 : 0;
        (this.loveTextMesh.material as THREE.Material).opacity += (targetOpacity - (this.loveTextMesh.material as THREE.Material).opacity) * 0.05;
        this.loveTextMesh.position.y = Math.sin(Date.now() * 0.002) * 0.5;
    }
    if (this.carouselTextMesh) {
        const targetOpacity = (this.currentState === AppState.CAROUSEL && !this.isQuoteFading) ? 1 : 0;
        (this.carouselTextMesh.material as THREE.Material).opacity += (targetOpacity - (this.carouselTextMesh.material as THREE.Material).opacity) * 0.05;
    }

    // Particles
    if (this.particlesSystem) this.updateParticles(this.particlesSystem, false);
    if (this.decorationSystem) this.updateParticles(this.decorationSystem, true);
    
    // Photos velocity in explode
    if (this.currentState === AppState.EXPLODE) {
        this.photos.forEach(p => {
            if (p === this.zoomedPhoto) return;
            p.lookAt(this.camera.position);
            p.position.add(p.userData.velocity);
            if(p.position.length() > 50) p.userData.velocity.multiplyScalar(-1);
        });
    }

    if (this.inputMode === null) {
        // Idle animation
        const t = Date.now() * 0.0005;
        this.camera.position.x = Math.sin(t) * 45;
        this.camera.position.z = Math.cos(t) * 45;
        this.camera.lookAt(0, 0, 0);
    }

    this.renderer.render(this.scene, this.camera);
  }

  private updateCursorInteraction() {
      // Raycasting
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.photos);
      
      if (this.handData.isPinching) {
          if (!this.zoomedPhoto && intersects.length > 0) {
              this.zoomInPhoto(intersects[0].object as THREE.Mesh);
          }
      } else {
          if (this.zoomedPhoto) {
              this.zoomOutPhoto(this.zoomedPhoto);
          }
      }

      if (!this.zoomedPhoto && intersects.length > 0) {
          const target = intersects[0].object;
          if (target.scale.x < 1.2) {
              target.scale.set(1.2, 1.2, 1.2);
          }
      }
  }

  private zoomInPhoto(target: THREE.Mesh) {
      this.zoomedPhoto = target;
      new TWEEN.Tween(target.scale).to({ x: 3, y: 3, z: 3 }, 500).easing(TWEEN.Easing.Back.Out).start();
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);
      const targetPos = this.camera.position.clone().add(camDir.multiplyScalar(10));
      new TWEEN.Tween(target.position).to({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, 500).start();
      target.lookAt(this.camera.position);
  }

  private zoomOutPhoto(target: THREE.Mesh) {
    new TWEEN.Tween(target.scale).to({ x: 1, y: 1, z: 1 }, 500).start();
    target.userData.velocity.set(
        (Math.random()-0.5)*0.02, 
        (Math.random()-0.5)*0.02, 
        (Math.random()-0.5)*0.02
    );
    this.zoomedPhoto = null;
  }

  private updateHeartMomentPhotos() {
    if (Date.now() - this.lastFlashTime > 800) {
        this.lastFlashTime = Date.now();
        if (this.currentVisiblePhoto) {
            new TWEEN.Tween((this.currentVisiblePhoto.material as THREE.Material)).to({ opacity: 0 }, 500).start();
        }
        if (this.shuffledIndices.length !== this.photos.length) {
            this.shuffledIndices = Array.from({length: this.photos.length}, (_, i) => i);
            for (let i = this.shuffledIndices.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [this.shuffledIndices[i], this.shuffledIndices[j]] = [this.shuffledIndices[j], this.shuffledIndices[i]];
            }
        }
        const photoIndex = this.shuffledIndices[this.currentFlashIndex];
        const nextPhoto = this.photos[photoIndex];
        
        nextPhoto.scale.set(1.5, 1.5, 1.5);
        const r = 10;
        const theta = Math.random() * Math.PI * 2;
        nextPhoto.position.set(Math.cos(theta) * r, (Math.random() - 0.5) * 10, Math.sin(theta) * r);
        nextPhoto.lookAt(this.camera.position);
        
        new TWEEN.Tween((nextPhoto.material as THREE.Material)).to({ opacity: 1 }, 500).start();
        this.currentVisiblePhoto = nextPhoto;
        this.currentFlashIndex = (this.currentFlashIndex + 1) % this.shuffledIndices.length;
    }
  }

  private updateCarouselTextLoop() {
    if (Date.now() - this.lastQuoteTime > 4000) { 
        this.lastQuoteTime = Date.now();
        this.isQuoteFading = true;
        if (this.carouselTextMesh) {
            new TWEEN.Tween((this.carouselTextMesh.material as THREE.Material)).to({ opacity: 0 }, 1000)
            .onComplete(() => {
                this.currentQuoteIndex = (this.currentQuoteIndex + 1) % CONFIG.loveQuotes.length;
                this.createCarouselText(CONFIG.loveQuotes[this.currentQuoteIndex]);
                this.isQuoteFading = false;
            })
            .start();
        }
    }
  }

  private onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  public dispose() {
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    cancelAnimationFrame(this.animationId);
    this.renderer.dispose();
  }
}
