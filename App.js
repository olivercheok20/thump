"use strict";

import { GLView } from "expo-gl";
import { Renderer } from "expo-three";
import * as ScreenOrientation from "expo-screen-orientation";
import * as React from "react";
import { AppState, Modal, Text, Vibration, View } from "react-native";
import { gsap, Quad } from "gsap";
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
import * as GLOBAL from "./global.js";
import { useFonts, Montserrat_500Medium } from "@expo-google-fonts/montserrat";


ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);

export default function App() {
  let timeout;
  let [fontsLoaded] = useFonts({Montserrat_500Medium});
  const appState = React.useRef(AppState.currentState);
  const [screenWidth, setScreenWidth] = React.useState(0);
  const [screenHeight, setScreenHeight] = React.useState(0);
  const [modalOpen, setModalOpen] = React.useState(false);

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
  var torusGeometry;
  var material;

  var gl;

  var cols;
  var rows;

  // Initialise data structures for animation
  var objects = [];
  var touches = {};
  var draggedObjects = {};
  var active = {};
  var maxDrag = 0;
  var quakes = [];

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
    // console.log('Touch start:', e.nativeEvent.identifier);
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
      if (GLOBAL.vibration) {
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

      // if (e.nativeEvent.locationY < 100 && e.nativeEvent.locationY > 0) {
      //   touch.y = - ((e.nativeEvent.locationY + 100) / screenHeight) * 2 + 1
      // }
      // else if (e.nativeEvent.locationY < 100) {
      //   touch.y = - ((e.nativeEvent.locationY - 500) / screenHeight) * 2 + 1
      // }

      const raycaster = new Raycaster();
      raycaster.setFromCamera(touch, camera);

      var plane = new Plane(new Vector3(0, 0, 1), - object.original.z);

      var intersects = new Vector3();
      
      object.position.y = Math.max(GLOBAL.blockHeight / -2, raycaster.ray.intersectPlane(plane, intersects).y);
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
      var height = object.position.y + GLOBAL.blockHeight / 2;
      var time = Math.sqrt(2 * height / GLOBAL.gravity);
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
          y: GLOBAL.blockHeight / -2,
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
    rows = Math.ceil(3 * (Math.ceil(viewHeight * Math.SQRT1_2) - 3) / 4);

    // Create camera
    camera = new OrthographicCamera(viewWidth / -2, viewWidth / 2, viewHeight / 2, viewHeight / -2, 1, 1000);
    camera.position.set(0, 50, 100);
    camera.lookAt(0, 0, 0);

    // Create renderer
    renderer = new Renderer({ gl });
    // renderer.setClearColor(background);
    renderer.setClearColor(GLOBAL.background, 0);
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);

    // Create scene
    scene = new Scene();

    // Create lights
    directionalLight = new DirectionalLight(GLOBAL.directionalColor, GLOBAL.directionalIntensity);
    directionalLight.position.set(10, 20, 0);
    scene.add(directionalLight);

    ambientLight = new AmbientLight(GLOBAL.ambientColor, GLOBAL.ambientIntensity);
    scene.add(ambientLight);

    // Create geometry and material for objects
    rectGeometry = new BoxGeometry(3, GLOBAL.blockHeight, 1);
    squareGeometry = new BoxGeometry(GLOBAL.squareSide, GLOBAL.blockHeight, GLOBAL.squareSide);
    cylinderGeometry = new CylinderGeometry(GLOBAL.circleRadius, GLOBAL.circleRadius, GLOBAL.blockHeight, 32);
    sphereGeometry = new SphereGeometry(GLOBAL.sphereRadius, 32, 32);
    torusGeometry = new TorusGeometry(GLOBAL.torusRadius, GLOBAL.torusTube, 32, 32);
    material = new MeshLambertMaterial({ color: GLOBAL.blockColor });

    // Initialise data structures for animation
    touches = {};
    draggedObjects = {};
    active = {};
    maxDrag = 0;
    quakes = [];
    objects = [];
    
    // Draw meshes
    for (var i = 0; i < cols; i++) {
      for (var j = 0; j < rows; j++) {

        switch (GLOBAL.shape) {
          case GLOBAL.RECTANGLE:
            var mesh = new Mesh(rectGeometry, material);
            break;
          case GLOBAL.SQUARE:
            var mesh = new Mesh(squareGeometry, material);
            break;
          case GLOBAL.CIRCLE:
            var mesh = new Mesh(cylinderGeometry, material);
            break;
          case GLOBAL.SPHERE:
            var mesh = new Mesh(sphereGeometry, material);
            break;
          case GLOBAL.TORUS:
            var mesh = new Mesh(torusGeometry, material);
            break;
          }

        if ((i + j) % 2 == 0) {
          mesh.position.set(
            (i - cols / 2 + 0.5) * Math.sqrt(2),
            GLOBAL.blockHeight / -2,
            (j - rows / 3) * 2 * Math.sqrt(2)
          );
          if (GLOBAL.shape == GLOBAL.RECTANGLE || GLOBAL.shape == GLOBAL.SQUARE) {
            if (i % 2 == 0) {
              mesh.rotation.set(0, Math.PI / 4, 0);
            } else {
              mesh.rotation.set(0, Math.PI / -4, 0);
            }
          } else if (GLOBAL.shape == GLOBAL.TORUS) {
            mesh.rotation.set(Math.PI / 2, 0, 0);
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
      if (GLOBAL.vibration) {
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
          if (dist_from_source >= quake.radius && dist_from_source < quake.radius + GLOBAL.wavespeed / GLOBAL.timeScale) {
            objects[j].velocity += Math.max(Math.sqrt(2 * GLOBAL.gravity * quake.height), GLOBAL.minVelocity);
            quake.raised += 1;
            if (quake.raised == rows * cols / 2 - 1) {
              quakes_to_delete.push(i);
            }
          }
        }
        quake.radius += GLOBAL.wavespeed / GLOBAL.timeScale;
      }

      for (var j = 0; j < objects.length; j++) {
        if (objects[j].falling || objects[j].dragged) {
          continue;
        }
        objects[j].position.y += objects[j].velocity / GLOBAL.timeScale; // scale this by time
        objects[j].velocity -= GLOBAL.gravity / GLOBAL.timeScale;
        objects[j].velocity = Math.min(objects[j].velocity, GLOBAL.maxVelocity);
        if (objects[j].position.y < GLOBAL.blockHeight / -2) {
          objects[j].position.y = GLOBAL.blockHeight / -2;
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
    >
      <View
        style={{ 
          flex: 1,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 209, 220, 1)',
        }}
      >
      </View>
      <View 
        style={{ 
          flex: 1,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 200,
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          backgroundColor: 'rgba(0, 0, 0, 0)',
          paddingTop: 50
        }}
      >

        {fontsLoaded && <Text 
          style={{
            fontSize: 72,
            fontFamily: 'Montserrat_500Medium',
          }}
        >
          thump
        </Text>}
      </View>
      <GLView 
        style={{ flex: 1 }} 
        onContextCreate={onContextCreate} 
        onTouchStart={handleBlockTouchStart} 
        onTouchEnd={handleBlockTouchEnd} 
        onTouchMove={handleBlockTouchMove}
        onLayout={(e) => {
          setScreenWidth(e.nativeEvent.layout.width);
          setScreenHeight(e.nativeEvent.layout.height);
        }}
      />
      <View 
        style={{ 
          flex: 1,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 200,
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          backgroundColor: 'rgba(0, 0, 0, 0)',
          paddingTop: 50
        }}
        onTouchStart={() => setModalOpen(true)}
      >
      </View>
      {/* <Modal
        animationType={'fade'}
        transparent={true}
        visible={modalOpen}
        statusBarTranslucent={true}
      >
        <View
          style={{
            flex: 1,
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
          }}
          onTouchStart={() => {
            setModalOpen(false);
          }}
        >
          <View
            style={{
              flex: 1,
              position: 'absolute',
              top: 100,
              bottom: 100,
              left: 100,
              right: 100,
              backgroundColor: 'rgb('
            }}
          >
          </View>
        </View>

      </Modal> */}

    </View>
  );
}