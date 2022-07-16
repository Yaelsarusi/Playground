import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as dat from 'lil-gui'
import gsap from 'gsap'

/**
 * Base
 */
// Debug
const gui = new dat.GUI()

// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

/**
 * Textures
 */
const textureLoader = new THREE.TextureLoader()

/**
 * House
 */
// Temporary sphere
const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 32),
    new THREE.MeshStandardMaterial({ roughness: 0.7 })
)
sphere.position.z = 2

scene.add(sphere)

// Floor
const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ color: '#a9c388' })
)
scene.add(floor)

console.log({floor})

/**
 * Lights
 */
// Ambient light
const ambientLight = new THREE.AmbientLight('#ffffff', 0.5)
gui.add(ambientLight, 'intensity').min(0).max(1).step(0.001)
scene.add(ambientLight)

// Directional light
const moonLight = new THREE.DirectionalLight('#ffffff', 0.5)
moonLight.position.set(4, 5, - 2)
gui.add(moonLight, 'intensity').min(0).max(1).step(0.001)
gui.add(moonLight.position, 'x').min(- 5).max(5).step(0.001)
gui.add(moonLight.position, 'y').min(- 5).max(5).step(0.001)
gui.add(moonLight.position, 'z').min(- 5).max(5).step(0.001)
scene.add(moonLight)

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

window.addEventListener('resize', () =>
{
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100)
camera.position.x = 0
camera.position.y =-6
camera.position.z = 10
camera.rotation.x = Math.PI * 0.125
scene.add(camera)

gui.add(camera.position, 'x').min(-20).max(20).step(0.5)
gui.add(camera.position, 'y').min(-20).max(20).step(0.5)
gui.add(camera.position, 'z').min(-20).max(20).step(0.5)
gui.add(camera.rotation, 'x').min(0).max(Math.PI*4).step(0.01)
gui.add(camera.rotation, 'z').min(0).max(Math.PI*4).step(0.01)
// Controls
// const controls = new OrbitControls(camera, canvas)
// controls.enableDamping = true

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas
})
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

/**
 * Animate
 */
function onkeydown(e) {
    console.log({position: sphere.position})
    if (e.keyCode == 39) {
        if ( sphere.position.x + sphere.geometry.boundingSphere.radius* 2 < 9) {
            gsap.to(sphere.position, { duration: 0.25, delay: 0, x:sphere.position.x +sphere.geometry.boundingSphere.radius})
        }
    } //right arrow
    else if (e.keyCode == 37) {
        if (sphere.position.x - sphere.geometry.boundingSphere.radius* 2 > -9) {
            gsap.to(sphere.position, { duration: 0.25, delay: 0, x:sphere.position.x -sphere.geometry.boundingSphere.radius})
        }
    } //left arrow
    else if (e.keyCode == 38) {
        if (sphere.position.y + sphere.geometry.boundingSphere.radius* 2 < 9) {
            gsap.to(sphere.position, { duration: 0.25, delay: 0, y:sphere.position.y +sphere.geometry.boundingSphere.radius})
        }
    } //up arrow
    else if (e.keyCode == 40) {
        if (sphere.position.y - sphere.geometry.boundingSphere.radius* 2 > -9) {
            gsap.to(sphere.position, { duration: 0.25, delay: 0, y:sphere.position.y -sphere.geometry.boundingSphere.radius})
        }
    } //down arrow
}
window.addEventListener("keydown", onkeydown);

const clock = new THREE.Clock()

const tick = () =>
{
    const elapsedTime = clock.getElapsedTime()

    // Update controls
    // controls.update()

    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()