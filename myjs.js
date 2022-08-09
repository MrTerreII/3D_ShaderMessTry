import * as THREE from './node_modules/three/src/Three.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.143/examples/jsm/controls/OrbitControls.js';
import { DragControls } from 'https://cdn.jsdelivr.net/npm/three@0.143/examples/jsm/controls/DragControls.js';
//import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.143/build/three.module.js'; //At the end this works better. Just delete packages and node_modules

//@ts-check

class RigidBody {
    constructor() {
    }

    setRestitution(val) {
        this.body_.setRestitution(val);
    }

    setFriction(val) {
        this.body_.setFriction(val);
    }

    setRollingFriction(val) {
        this.body_.setRollingFriction(val);
    }

    createBox(mass, pos, quat, size) {
        this.transform_ = new Ammo.btTransform();
        this.transform_.setIdentity();
        this.transform_.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
        this.transform_.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));
        this.motionState_ = new Ammo.btDefaultMotionState(this.transform_);

        const btSize = new Ammo.btVector3(size.x * 0.5, size.y * 0.5, size.z * 0.5);
        this.shape_ = new Ammo.btBoxShape(btSize);
        this.shape_.setMargin(0.05);

        this.inertia_ = new Ammo.btVector3(0, 0, 0);
        if (mass > 0) {
            this.shape_.calculateLocalInertia(mass, this.inertia_);
        }

        this.info_ = new Ammo.btRigidBodyConstructionInfo(
            mass, this.motionState_, this.shape_, this.inertia_);
        this.body_ = new Ammo.btRigidBody(this.info_);

        Ammo.destroy(btSize);
    }

    createSphere(mass, pos, size) {
        this.transform_ = new Ammo.btTransform();
        this.transform_.setIdentity();
        this.transform_.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
        this.transform_.setRotation(new Ammo.btQuaternion(0, 0, 0, 1));
        this.motionState_ = new Ammo.btDefaultMotionState(this.transform_);

        this.shape_ = new Ammo.btSphereShape(size);
        this.shape_.setMargin(0.05);

        this.inertia_ = new Ammo.btVector3(0, 0, 0);
        if (mass > 0) {
            this.shape_.calculateLocalInertia(mass, this.inertia_);
        }

        this.info_ = new Ammo.btRigidBodyConstructionInfo(mass, this.motionState_, this.shape_, this.inertia_);
        this.body_ = new Ammo.btRigidBody(this.info_);
    }
}

class WorldMeshShaders {
    /* Physics constants of the World */
    gravityConstant = - 9.8;
    physicsWorld;
    rigidBodies = [];
    softBodies = [];
    margin = 0.05;
    transformAux1;
    softBodyHelpers;
    //////
    startfalling = false;

    boxes = [];

    constructor() {
        this._Init();
    }

    _Init() {
        this._InitPhysics();
        this._threejs = new THREE.WebGLRenderer({
            antialias: true,
        });
        this._threejs.shadowMap.enabled = true;
        this._threejs.shadowMap.type = THREE.PCFSoftShadowMap;
        this._threejs.setPixelRatio(window.devicePixelRatio);
        this._threejs.setSize(window.innerWidth, window.innerHeight);

        document.body.appendChild(this._threejs.domElement);

        window.addEventListener('resize', () => {
            this._WResize();
        }, false);

        const fov = 60;
        const aspect = 1920 / 1080;
        const near = 1.0;
        const far = 1000.0;
        this._camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        this._camera.position.set(75, 20, 0);

        this._scene = new THREE.Scene();
        this.clock = new THREE.Clock();

        let light = new THREE.DirectionalLight(0xFFFFFF, 1.0);
        light.position.set(20, 100, 10);
        light.target.position.set(0, 0, 0);
        light.castShadow = true;
        light.shadow.bias = -0.001;
        light.shadow.mapSize.width = 2048;
        light.shadow.mapSize.height = 2048;
        light.shadow.camera.near = 0.1;
        light.shadow.camera.far = 500.0;
        light.shadow.camera.near = 0.5;
        light.shadow.camera.far = 500.0;
        light.shadow.camera.left = 100;
        light.shadow.camera.right = -100;
        light.shadow.camera.top = 100;
        light.shadow.camera.bottom = -100;
        this._scene.add(light);

        light = new THREE.AmbientLight(0xcde6f8);
        this._scene.add(light);


        this.controls = new OrbitControls(
            this._camera, this._threejs.domElement
        );
        this.controls.target.set(0, 20, 0);
        this.controls.update();

        const textureLoader = new THREE.TextureLoader();

        let textureEquirec;
        textureEquirec = textureLoader.load('resources/kitchen.jpg');
        textureEquirec.mapping = THREE.EquirectangularReflectionMapping;
        textureEquirec.encoding = THREE.sRGBEncoding;

        this._scene.background = textureEquirec;

        const ground = new THREE.Mesh(
            new THREE.BoxGeometry(100, 1, 100),
            new THREE.MeshStandardMaterial({ color: 0x404040 }));
        ground.castShadow = false;
        ground.receiveShadow = true;
        this._scene.add(ground);

        const rbGround = new RigidBody();
        rbGround.createBox(0, ground.position, ground.quaternion, new THREE.Vector3(100, 1, 100));
        rbGround.setRestitution(0.99);
        this.physicsWorld.addRigidBody(rbGround.body_);

        this.rigidBodies_ = [];

        const box = new THREE.Mesh(
            new THREE.BoxGeometry(2, 2, 2),
            new THREE.MeshStandardMaterial({
                color: 0xFF0000,
            }));
        box.position.set(0, 10, 0);
        box.castShadow = true;
        box.receiveShadow = true;
        
        const rbBox = new RigidBody();
        rbBox.createBox(5, box.position, box.quaternion, new THREE.Vector3(2, 2, 2), null);
        rbBox.setRestitution(0.25);
        rbBox.setFriction(1);
        rbBox.setRollingFriction(5);
        this.physicsWorld.addRigidBody(rbBox.body_);
        
        this._scene.add(this.box);

        this.boxes.push(this.box);

        this.rigidBodies_.push({mash: box, rigidBody: rbBox});

        this.dragcontrol = new DragControls([... this.boxes], this._camera, this._threejs.domElement);
        this.dragcontrol.addEventListener('dragstart', () => {
            this.startfalling = false;
            this.controls.enabled = false;
            this.clock.stop();
        });
        this.dragcontrol.addEventListener('dragend', () => {
            this.startfalling = true;
            this.controls.enabled = true;
            this.clock.start();
        });

        this.tmpTransform_ = new Ammo.btTransform();

        this.countdown = 1.0;
        this.count = 0;
        this.previousRAF_ = null;
        this._RAF();
    }

    _InitPhysics() {
        const collisionConfiguration = new Ammo.btSoftBodyRigidBodyCollisionConfiguration();
        const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
        const broadphase = new Ammo.btDbvtBroadphase();
        const solver = new Ammo.btSequentialImpulseConstraintSolver();
        const softBodySolver = new Ammo.btDefaultSoftBodySolver();
        this.physicsWorld = new Ammo.btSoftRigidDynamicsWorld(dispatcher, broadphase, solver, collisionConfiguration, softBodySolver);
        this.physicsWorld.setGravity(new Ammo.btVector3(0, this.gravityConstant, 0));
        this.physicsWorld.getWorldInfo().set_m_gravity(new Ammo.btVector3(0, this.gravityConstant, 0));
        this.softBodyHelpers = new Ammo.btSoftBodyHelpers();
    }

    _WResize() {
        this._camera.aspect = window.innerWidth / window.innerHeight;
        this._camera.updateProjectionMatrix();
        this._threejs.setSize(window.innerWidth, window.innerHeight);
    }

    _RAF() {
        requestAnimationFrame((time) => {
            if (this.previousRAF_ === null) {
                this.previousRAF_ = time;
            }
            this._STEP(time - this.previousRAF_);
            this._threejs.render(this._scene, this._camera);
            this._RAF();
            this.previousRAF_ = time;
        });
    }

    _STEP(timeElapsed) {
        const timeElapsedS = timeElapsed * 0.001;
        
        this.countdown -= timeElapsedS;
        if (this.countdown < 0 && this.count < 10) {
            this.countdown = 0.25;
            this.count += 1;
        }

        this.physicsWorld.stepSimulation(timeElapsedS, 10);
        for (let i = 0; i < this.rigidBodies_.length; ++i) {
            this.rigidBodies_[i].rigidBody.motionState_.getWorldTransform(this.tmpTransform_);
            const pos = this.tmpTransform_.getOrigin();
            const quat = this.tmpTransform_.getRotation();
            const pos3 = new THREE.Vector3(pos.x(), pos.y(), pos.z());
            const quat3 = new THREE.Quaternion(quat.x(), quat.y(), quat.z(), quat.w());
      
            this.rigidBodies_[i].mesh.position.copy(pos3);
            this.rigidBodies_[i].mesh.quaternion.copy(quat3);
          }
    }

}

let _APP = null;

//onDOMContentLoaded = (event) => {}; Same as the next thing
window.addEventListener('DOMContentLoaded', () => {
    Ammo().then((lib) => {
        Ammo = lib;
        _APP = new WorldMeshShaders();
    });
});