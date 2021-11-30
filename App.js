"use strict";

import { GLView } from "expo-gl";
import { Renderer } from "expo-three";
import * as ScreenOrientation from 'expo-screen-orientation';
import * as React from "react";
import { AppState, Button, Modal, Text, Vibration, View } from "react-native";
import { gsap, Quad } from 'gsap';
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
import { useFonts, Montserrat_500Medium } from "@expo-google-fonts/montserrat";

ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);

export default function App() {
  let timeout;
  let [fontsLoaded] = useFonts({Montserrat_500Medium})
  const appState = React.useRef(AppState.currentState);

  const RECTANGLE = 1;
  const SQUARE = 2;
  const CIRCLE = 3;
  const SPHERE = 4;
  const TORUS = 5;

  var set = false;

  const [render, setRender] = React.useState(null);

  // User adjustable variables
  const [gravity, setGravity] = React.useState(60);
  const [wavespeed, setWavespeed] = React.useState(20);
  const [minVelocity, setMinVelocity] = React.useState(5);
  const [maxVelocity, setMaxVelocity] = React.useState(10);
  const [background, setBackground] = React.useState(0xffd1dc);
  const [ambientColor, setAmbientColor] = React.useState(0xffffff);
  const [ambientIntensity, setAmbientIntensity] = React.useState(0.1);
  const [directionalColor, setDirectionalColor] = React.useState(0xffffff);
  const [directionalIntensity, setDirectionalIntensity] = React.useState(1);
  const [blockColor, setBlockColor] = React.useState(0xffffff);

  const [blockHeight, setBlockHeight] = React.useState(2);
  const [timeScale, setTimeScale] = React.useState(20);
  const [squareSide, setSquareSide] = React.useState(1);
  const [circleRadius, setCircleRadius] = React.useState(1);
  const [sphereRadius, setSphereRadius] = React.useState(1);
  const [torusRadius, setTorusRadius] = React.useState(1);
  const [torusTube, setTorusTube] = React.useState(0.3);
  const [shape, setShape] = React.useState(RECTANGLE);
  const [vibration, setVibration] = React.useState(true);
  const [refresh, setRefresh] = React.useState('');

  const [modalOpen, setModalOpen] = React.useState(false);
  const [screenWidth, setScreenWidth] = React.useState(0);
  const [screenHeight, setScreenHeight] = React.useState(0);

  const [scene, setScene] = React.useState(new Scene());
  const [renderer, setRenderer] = React.useState(null);
  const [camera, setCamera] = React.useState(null);
  const [viewWidth, setViewWidth] = React.useState(0);
  const [viewHeight, setViewHeight] = React.useState(0);
  const [cols, setCols] = React.useState(0);
  const [rows, setRows] = React.useState(0);
  const [directionalLight, setDirectionalLight] = React.useState(null);
  const [ambientLight, setAmbientLight] = React.useState(null);
  const [rectGeometry, setRectGeometry] = React.useState(null);
  const [squareGeometry, setSquareGeometry] = React.useState(null);
  const [cylinderGeometry, setCylinderGeometry] = React.useState(null);
  const [sphereGeometry, setSphereGeometry] = React.useState(null);
  const [torusGeometry, setTorusGeometry] = React.useState(null);
  const [material, setMaterial] = React.useState(null);

  const [gl, setGl] = React.useState(null);

  var contexts = 0;
  var objects = [];
  var touches = {};
  var draggedObjects = {};
  var active = {};
  var maxDrag = 0;
  var quakes = [];

  React.useEffect(() => {
    if (render != null) {
      render();
    }
  },
  [render]);

  React.useEffect(() => {
    const ambientLight_= new AmbientLight(ambientColor, ambientIntensity);
    scene.add(ambientLight_)
    setAmbientLight(ambientLight_);  
  },
  [ambientColor, ambientIntensity, scene]);

  React.useEffect(() => {
    const directionalLight_ = new DirectionalLight(directionalColor, directionalIntensity);
    directionalLight_.position.set(10, 20, 0);
    scene.add(directionalLight_)
    setDirectionalLight(directionalLight_);
  },
  [directionalColor, directionalIntensity, scene]);

  React.useEffect(() => {
    if (renderer != null && gl != null && scene != null && camera != null) {
      // Setup an animation loop
      setRender(() => {
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
        console.log(gl.context);
      });
    }
  },
  [gl, renderer, camera, scene]);

  React.useEffect(() => {
    if (!scene) {
      return;
    }
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
          case TORUS:
            var mesh = new Mesh(torusGeometry, material);
            break;
          }

        if ((i + j) % 2 == 0) {
          mesh.position.set(
            (i - cols / 2 + 0.5) * Math.sqrt(2),
            blockHeight / -2,
            (j - rows / 3 + 0.5) * 2 * Math.sqrt(2)
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
  },
  [
    cols, 
    rows, 
    rectGeometry, 
    squareGeometry, 
    cylinderGeometry, 
    sphereGeometry, 
    torusGeometry, 
    material, 
    blockHeight, 
    shape, 
  ]);

  React.useEffect(() => {
    if (gl != null) {
      // Create renderer
      const renderer_ = new Renderer({ gl, alpha: true });
      // renderer.setClearColor(background, 0);
      renderer_.setClearColor(background);
      renderer_.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
      setRenderer(renderer_);
    }
  },
  [gl, background]);

  React.useEffect(() => {
    setMaterial(new MeshLambertMaterial({ color: blockColor }));
  },
  [blockColor]);

  React.useEffect(() => {
    setTorusGeometry(new TorusGeometry(torusRadius, torusTube, 32, 32));
  },
  [torusRadius, torusTube]);

  React.useEffect(() => {
    setSphereGeometry(new SphereGeometry(sphereRadius, 32, 32));
  },
  [sphereRadius]);

  React.useEffect(() => {
    setCylinderGeometry(new CylinderGeometry(circleRadius, circleRadius, blockHeight, 32));
  },
  [circleRadius, blockHeight]);

  React.useEffect(() => {
    setSquareGeometry(new BoxGeometry(squareSide, blockHeight, squareSide));
  },
  [blockHeight, squareSide]);

  React.useEffect(() => {
    setRectGeometry(new BoxGeometry(3, blockHeight, 1));
  },
  [blockHeight]);

  React.useEffect(() => {
    if (gl != null) {
      const viewHeight_ = viewWidth * (gl.drawingBufferHeight / gl.drawingBufferWidth);
      setViewHeight(viewHeight_);
      setCols(Math.ceil(viewWidth * Math.SQRT1_2) - 4);
      setRows(Math.floor(3 * (Math.ceil(viewHeight_ * Math.SQRT1_2) - 3) / 4));  
    }
  },
  [viewWidth, gl]);

  React.useEffect(() => {
    const camera_ = new OrthographicCamera(viewWidth / -2, viewWidth / 2, viewHeight / 2, viewHeight / -2, 1, 1000);
    camera_.position.set(0, 50, 100);
    camera_.lookAt(0, 0, 0);
    setCamera(camera_);
  },
  [viewHeight]);

  React.useEffect(() => {
    contexts = 0;
    objects = [];
    touches = {};
    draggedObjects = {};
    active = {};
    maxDrag = 0;
    quakes = [];
  },
  [modalOpen]);

  // React.useEffect(() => {
  //   AppState.addEventListener("change", nextAppState => {
  //     Vibration.cancel();
  //     if (!(
  //       appState.current.match(/inactive|background/) &&
  //       nextAppState === "active"
  //     )) {
  //       setRefresh('');
  //       if (gl != null) {
  //         (async () => {
  //           let response = await onContextCreate(gl);
  //         })();
  //       }
  //     }
  //   });

  //   // Clear the animation loop when the component unmounts
  //   return () => {
  //     clearTimeout(timeout);
  //   }
  // }, []);

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
    glContext.context = currentContext;

    setViewWidth(30);

    setGl(glContext); 
  };

  return (
    <View style={{ flex: 1 }}>
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
          top: 100,
          left: 0,
          right: 0,
          height: 100,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0)',
        }}
        onTouchStart={() => setModalOpen(true)}
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
      <Modal
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

      </Modal>
    </View>
  );
}