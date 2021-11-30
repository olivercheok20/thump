"use strict";

import { GLView } from "expo-gl";
import { Renderer } from "expo-three";
import * as ScreenOrientation from 'expo-screen-orientation';
import * as React from "react";
import { AppState, Vibration, View } from "react-native";
import { gsap, Quad } from 'gsap';
import Draggable from 'react-native-draggable';
import {
  Scene,
  OrthographicCamera,
  DirectionalLight,
  AmbientLight,
  Raycaster,
  Plane,
  BoxGeometry,
  CylinderGeometry,
  SphereGeometry,
  TorusGeometry,
  MeshLambertMaterial,
  Mesh,
  Vector2,
  Vector3
} from "three";

ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);

export default function App() {
  let timeout;
  const appState = React.useRef(AppState.currentState);
  const [buttonSize, setButtonSize] = React.useState(40);
  const [screenWidth, setScreenWidth] = React.useState(0);
  const [screenHeight, setScreenHeight] = React.useState(0);
  const [draggableX, setDraggableX] = React.useState(100);
  const [draggableY, setDraggableY] = React.useState(100);

  var scene;
  var renderer;
  var camera;
  var viewWidth = 30;
  var viewHeight;
  var directionalLight;
  var ambientLight;
  var rectGeometry;
  var squareGeometry;
  var cylinderGeometry;
  var sphereGeometry;
  var ngonGeometry;
  var torusGeometry;
  var material;

  var gl;


  var objects;
  var cols;
  var rows;
  var touches;
  var draggedObjects;
  var active;
  var maxDrag;
  var quakes;

  const RECTANGLE = 1;
  const SQUARE = 2;
  const CIRCLE = 3;
  const NGON = 4;
  const SPHERE = 5;
  const TORUS = 6;

  // User adjustable variables
  const gravity = 60;
  const wavespeed = 20;
  const minVelocity = 5;
  const maxVelocity = 10;
  const background = 0xffd1dc;
  const ambientColor = 0xffffff;
  const ambientIntensity = 0.1;
  const directionalColor = 0xffffff;
  const directionalIntensity = 1;
  const blockColor = 0xffffff;
  const blockHeight = 2;
  const timeScale = 20;
  const squareSide = 1;
  const circleRadius = 1;
  const sphereRadius = 1;
  const torusRadius = 1;
  const torusTube = 0.3;
  const ngonSides = 5;
  const shape = RECTANGLE;
  const vibration = true;

  var contexts = 0;

  const [refresh, setRefresh] = React.useState('');

  React.useEffect(() => {
    AppState.addEventListener("change", nextAppState => {
      Vibration.cancel();
      if (!(
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      )) {
        setRefresh('');
        if (gl != null) {
          (async () => {
            console.log('Creating new context...')
            let response = await onContextCreate(gl);
          })();
        }
      }
    });

    // Clear the animation loop when the component unmounts
    return () => {
      clearTimeout(timeout);
    }
  }, []);

  const handleBlockTouchStart = (e) => {
    console.log('Touch start:', e.nativeEvent.identifier);
    if (e.nativeEvent.identifier + 1 == maxDrag) {
      return;
    }

    if (e.nativeEvent.touches.length == e.nativeEvent.identifier + 1) {
      maxDrag = Math.max(maxDrag, e.nativeEvent.touches.length);
      active[e.nativeEvent.identifier] = true;
    } else {
      return;
    }

    const touch = new Vector2(
      (e.nativeEvent.locationX / screenWidth) * 2 - 1,
      - (e.nativeEvent.locationY / screenHeight) * 2 + 1
    );

    touches[e.nativeEvent.identifier] = touch;
    const raycaster = new Raycaster();
    raycaster.setFromCamera(touch, camera);

    var intersects = raycaster.intersectObjects(objects, false)
    
    if (intersects.length > 0) {
      if (vibration) {
        Vibration.vibrate(15);
      }
      const object = intersects[0].object;
      object.timeline.clear()
      object.dragged = true;
      draggedObjects[e.nativeEvent.identifier] = object
    }
  }

  const handleBlockTouchMove = (e) => {
    // console.log('Touch move:', e.nativeEvent.identifier);

    if (!active[e.nativeEvent.identifier]) {
      return;
    }

    const object = draggedObjects[e.nativeEvent.identifier]
    
    if (object != null) {
      // console.log('Dragging...');
      const touch = new Vector2(
        (e.nativeEvent.locationX / screenWidth) * 2 - 1,
        - (e.nativeEvent.locationY / screenHeight) * 2 + 1
      );

      const raycaster = new Raycaster();
      raycaster.setFromCamera(touch, camera);

      var plane = new Plane(new Vector3(0, 0, 1), - object.original.z);

      var intersects = new Vector3();
      
      object.position.y = Math.max(blockHeight / -2, raycaster.ray.intersectPlane(plane, intersects).y);
    } else {
      // console.log('No intersecting object')
    }
  }

  const handleBlockTouchEnd = (e) => {
    // console.log('Touch end:', e.nativeEvent.identifier);
    active[e.nativeEvent.identifier] = false;
    if (e.nativeEvent.touches.length == 0) {
      maxDrag = 0;
    }
    const object = draggedObjects[e.nativeEvent.identifier];
    if (object != null) {
      object.dragged = false;
      var height = object.position.y + blockHeight / 2;
      var time = Math.sqrt(2 * height / gravity);
      const details = {
        object: object,
        height: height,
        time: time,
        radius: 0,
        raised: 0
      }
      object.timeline.to(
        object.position,
        time,
        {
          y: blockHeight / -2,
          ease: Quad.easeIn,
          onComplete: () => {
            quake(details);
          }
        }
      )
  
      object.falling = true;
      draggedObjects[e.nativeEvent.identifier] = null;
    }
  }

  const quake = (details) => {
    details.object.timeline = new gsap.timeline();
    details.object.falling = false;
    quakes.push(details);
  }

  const distance = (pointOne, pointTwo) => {
    const dist = Math.sqrt((pointOne.x - pointTwo.x) ** 2 + (pointOne.z - pointTwo.z) ** 2);
    return dist;
  }

  const onContextCreate = async (glContext) => {
    contexts += 1;
    const currentContext = contexts;

    gl = glContext; 

    // Dimensions of view
    viewWidth = 30;
    viewHeight = viewWidth * (gl.drawingBufferHeight / gl.drawingBufferWidth);

    cols = Math.ceil(viewWidth * Math.SQRT1_2) - 4;
    rows = Math.ceil(viewHeight * Math.SQRT1_2) - 3;

    // Create camera
    camera = new OrthographicCamera(viewWidth / -2, viewWidth / 2, viewHeight / 2, viewHeight / -2, 1, 1000);
    camera.position.set(0, 50, 100);
    camera.lookAt(0, 0, 0);

    // Create renderer
    renderer = new Renderer({ gl });
    renderer.setClearColor(background);
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);

    // Create scene
    scene = new Scene();

    // Create lights
    directionalLight = new DirectionalLight(directionalColor, directionalIntensity);
    directionalLight.position.set(10, 20, 0);
    scene.add(directionalLight);

    ambientLight = new AmbientLight(ambientColor, ambientIntensity);
    scene.add(ambientLight);

    // Initialise data structures for animation
    touches = {};
    draggedObjects = {};
    active = {};
    maxDrag = 0;
    quakes = [];

    // Create geometry and material for objects
    rectGeometry = new BoxGeometry(3, blockHeight, 1);
    squareGeometry = new BoxGeometry(squareSide, blockHeight, squareSide);
    cylinderGeometry = new CylinderGeometry(circleRadius, circleRadius, blockHeight, 32);
    sphereGeometry = new SphereGeometry(sphereRadius, 32, 32);
    ngonGeometry = new CylinderGeometry(circleRadius, circleRadius, blockHeight, ngonSides);
    torusGeometry = new TorusGeometry(torusRadius, torusTube, 32, 32);
    material = new MeshLambertMaterial({ color: blockColor });

    objects = [];
    
    // Draw meshes
    for (var i = 0; i < cols; i++) {
      for (var j = 0; j < rows; j++) {

        switch (shape) {
          case RECTANGLE:
            var mesh = new Mesh(rectGeometry, material);
            break;
          case SQUARE:
            var mesh = new Mesh(squareGeometry, material);
            break;
          case CIRCLE:
            var mesh = new Mesh(cylinderGeometry, material);
            break;
          case SPHERE:
            var mesh = new Mesh(sphereGeometry, material);
            break;
          case NGON:
            var mesh = new Mesh(ngonGeometry, material);
            break;
          case TORUS:
            var mesh = new Mesh(torusGeometry, material);
            break;
          }

        if ((i + j) % 2 == 0) {
          mesh.position.set(
            (i - cols / 2 + 0.5) * Math.sqrt(2),
            blockHeight / -2,
            (j - rows / 2 + 0.5) * 2 * Math.sqrt(2)
          );
          if (shape == RECTANGLE || shape == SQUARE) {
            if (i % 2 == 0) {
              mesh.rotation.set(0, Math.PI / 4, 0);
            } else {
              mesh.rotation.set(0, Math.PI / -4, 0);
            }
          } else if (shape == TORUS) {
            mesh.rotation.set(Math.PI / 2, 0, 0);
          } else if (shape == NGON) {
            mesh.rotation.set(0, Math.PI, 0);
          }

          mesh.original = {
            x: mesh.position.x,
            y: mesh.position.y,
            z: mesh.position.z,              
          }
          mesh.timeline = new gsap.timeline();
          mesh.velocity = 0;
          
          scene.add(mesh);
          objects.push(mesh);
        }
      }
    }

    // Setup an animation loop
    const render = () => {
      if (currentContext != contexts) {
        return;
      }
      timeout = requestAnimationFrame(render);
      renderer.render(scene, camera);
      const quakes_to_delete = [];
      if (vibration) {
        if (quakes.length > 0) {
          Vibration.vibrate([0, 50, 0], true);
        } else {
          Vibration.cancel();
        }
      }

      for (var i = 0; i < quakes.length; i++) {
        const quake = quakes[i];
        for (var j = 0; j < objects.length; j++) {
          if (objects[j] === quake.object) {
            continue;
          }
          const dist_from_source = distance(quake.object.position, objects[j].position);
          if (dist_from_source >= quake.radius && dist_from_source < quake.radius + wavespeed / timeScale) {
            objects[j].velocity += Math.max(Math.sqrt(2 * gravity * quake.height), minVelocity);
            quake.raised += 1;
            if (quake.raised == rows * cols / 2 - 1) {
              quakes_to_delete.push(i);
            }
          }
        }
        quake.radius += wavespeed / timeScale;
      }

      for (var j = 0; j < objects.length; j++) {
        if (objects[j].falling || objects[j].dragged) {
          continue;
        }
        objects[j].position.y += objects[j].velocity / timeScale; // scale this by time
        objects[j].velocity -= gravity / timeScale;
        objects[j].velocity = Math.min(objects[j].velocity, maxVelocity);
        if (objects[j].position.y < blockHeight / -2) {
          objects[j].position.y = blockHeight / -2;
          objects[j].velocity = 0;
        }
      }

      for (var i = quakes_to_delete.length - 1; i >= 0; i--) {
        quakes.splice(quakes_to_delete[i], 1);
      }
      gl.endFrameEXP();
    };
    render();
  };

  return (
    <View 
      style={{ flex: 1 }}
      onLayout={(e => {})}
    >
      <GLView 
        style={{ flex: 1 }} 
        onContextCreate={onContextCreate} 
        onTouchStart={handleBlockTouchStart} 
        onTouchEnd={handleBlockTouchEnd} 
        onTouchMove={handleBlockTouchMove}
        onLayout={(e) => {
          setScreenWidth(e.nativeEvent.layout.width);
          setScreenHeight(e.nativeEvent.layout.height);
          setDraggableX(e.nativeEvent.layout.width - 50);
          setDraggableY(e.nativeEvent.layout.height - 50);
        }}
      />
      <Draggable 
        x={draggableX} 
        y={draggableY} 
        renderSize={buttonSize} 
        isCircle 
        renderText=''
        renderColor='black'

      />
    </View>
  );
}