/**
 * Generates a self-contained HTML document with a three.js scene
 * that loads and animates a Wolf3D .glb avatar.
 *
 * Uses inline three.js (passed as parameter) to avoid CDN loading issues
 * in Android/iOS WebView.
 *
 * The scene receives { aiState, amplitude } via window message events
 * from React Native's injectJavaScript.
 */

export function getAvatarHtml(glbBase64: string, threeJsSrc: string, gltfLoaderSrc: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
  * { margin: 0; padding: 0; }
  body { background: transparent; overflow: hidden; }
  canvas { display: block; width: 100vw; height: 100vh; }
  #status { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
    color: rgba(255,255,255,0.5); font: 12px sans-serif; }
</style>
</head>
<body>
<div id="status">Loading 3D...</div>
<script>${threeJsSrc}</script>
<script>${gltfLoaderSrc}</script>
<script>
(function() {
  var statusEl = document.getElementById('status');

  function log(msg) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: msg }));
    }
  }

  function sendReady() {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
    }
  }

  function sendError(msg) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: msg }));
    }
  }

  if (typeof THREE === 'undefined') {
    sendError('three.js not loaded');
    statusEl.textContent = 'three.js not loaded';
    return;
  }

  if (!THREE.GLTFLoader) {
    sendError('GLTFLoader not loaded');
    statusEl.textContent = 'GLTFLoader not loaded';
    return;
  }

  log('three.js r' + THREE.REVISION);

  var DEG = Math.PI / 180;
  function lerp(a, b, t) { return a + (b - a) * t; }

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  document.body.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(24, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.68, 0.85);
  camera.lookAt(0, 1.63, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  var dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(2, 3, 4);
  scene.add(dirLight);
  var fillLight = new THREE.DirectionalLight(0xaabbff, 0.4);
  fillLight.position.set(-2, 1, -1);
  scene.add(fillLight);

  var aiState = 'idle';
  var amplitude = 0;
  var smoothMouth = 0;
  var lastNodTime = 0;
  var nodPhase = 0;
  var startTime = Date.now();

  var FACE_MESH_NAMES = ['Wolf3D_Head', 'Wolf3D_Teeth', 'EyeLeft', 'EyeRight'];
  var morphMeshes = [];
  var headBone = null;
  var spineBone = null;
  var headOrigQuat = null;
  var spineOrigQuat = null;

  var msgCount = 0;
  function onMsg(event) {
    try {
      var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (data.aiState !== undefined) aiState = data.aiState;
      if (data.amplitude !== undefined) amplitude = data.amplitude;
      msgCount++;
      if (msgCount % 90 === 1) {
        log('msg #' + msgCount + ' state=' + aiState + ' amp=' + amplitude.toFixed(3));
      }
    } catch(e) {}
  }
  window.addEventListener('message', onMsg);
  document.addEventListener('message', function(event) {
    try {
      var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (data.aiState !== undefined) aiState = data.aiState;
      if (data.amplitude !== undefined) amplitude = data.amplitude;
    } catch(e) {}
  });

  log('Decoding GLB...');
  try {
    var glbBase64 = "${glbBase64.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '')}";
    var binary = atob(glbBase64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    log('GLB decoded: ' + bytes.length + ' bytes');

    var loader = new THREE.GLTFLoader();
    loader.parse(bytes.buffer, '', function(gltf) {
      var model = gltf.scene;
      scene.add(model);
      log('Model added to scene');

      model.traverse(function(child) {
        if (child.isMesh && FACE_MESH_NAMES.indexOf(child.name) >= 0) {
          var dict = child.morphTargetDictionary || {};
          morphMeshes.push({
            mesh: child,
            mouthOpenIdx: dict['mouthOpen'] !== undefined ? dict['mouthOpen'] : -1,
            mouthSmileIdx: dict['mouthSmile'] !== undefined ? dict['mouthSmile'] : -1,
          });
        }
        if (child.isBone) {
          if (child.name === 'Head') headBone = child;
          if (child.name === 'Spine') spineBone = child;
        }
      });

      log('Morphs: ' + morphMeshes.length + ', head: ' + !!headBone + ', spine: ' + !!spineBone);

      statusEl.style.display = 'none';
      sendReady();
      animate();
    }, function(err) {
      var msg = 'GLB parse error: ' + (err.message || err);
      log(msg);
      sendError(msg);
      statusEl.textContent = 'Parse error';
    });
  } catch(e) {
    var msg = 'GLB decode error: ' + (e.message || e);
    log(msg);
    sendError(msg);
    statusEl.textContent = 'Decode error';
  }

  function animate() {
    requestAnimationFrame(animate);
    var t = (Date.now() - startTime) / 1000;

    var targetMouthOpen = 0;
    var targetSmile = 0;

    switch (aiState) {
      case 'idle':
        targetSmile = 0.55 + Math.sin(t * 0.5) * 0.15;
        break;
      case 'listening':
        targetSmile = 0.6;
        break;
      case 'thinking':
      case 'analyzing':
        targetSmile = 0.35;
        break;
      case 'speaking':
        targetMouthOpen = Math.min(1.0, amplitude * 4.0 * (0.85 + Math.random() * 0.3));
        if (targetMouthOpen < 0.15) targetMouthOpen = 0.15;
        break;
    }

    smoothMouth = lerp(smoothMouth, targetMouthOpen, 0.45);
    if (aiState !== 'speaking' && smoothMouth > 0.01) {
      smoothMouth = lerp(smoothMouth, 0, 0.25);
    }

    for (var m = 0; m < morphMeshes.length; m++) {
      var setup = morphMeshes[m];
      if (!setup.mesh.morphTargetInfluences) continue;
      if (setup.mouthOpenIdx >= 0) setup.mesh.morphTargetInfluences[setup.mouthOpenIdx] = smoothMouth;
      if (setup.mouthSmileIdx >= 0) setup.mesh.morphTargetInfluences[setup.mouthSmileIdx] = targetSmile;
    }

    if (headBone) {
      if (!headOrigQuat) headOrigQuat = headBone.quaternion.clone();

      var driftScale = (aiState === 'thinking' || aiState === 'analyzing') ? 0.5 : 1.0;
      var yawDeg = (Math.sin(t * 0.3) * 3 + Math.sin(t * 0.7) * 1.5) * driftScale;
      var pitchDeg = (Math.sin(t * 0.5 + 1) * 2 + Math.sin(t * 1.1) * 1) * driftScale;
      var rollDeg = Math.sin(t * 0.2 + 2) * 1.5 * driftScale;

      if (aiState === 'thinking' || aiState === 'analyzing') pitchDeg += 3;
      if (aiState === 'speaking') {
        yawDeg += amplitude * 2;
        pitchDeg += amplitude * 1.5;
      }
      if (aiState === 'listening') {
        var now = Date.now();
        if (nodPhase === 0 && now - lastNodTime > 2000 + Math.random() * 2000) {
          nodPhase = 1;
          lastNodTime = now;
        }
        if (nodPhase > 0) {
          var elapsed = now - lastNodTime;
          if (elapsed < 200) pitchDeg += (elapsed / 200) * 4;
          else if (elapsed < 600) pitchDeg += 4 * (1 - (elapsed - 200) / 400);
          else nodPhase = 0;
        }
      }

      var euler = new THREE.Euler(pitchDeg * DEG, yawDeg * DEG, rollDeg * DEG, 'YXZ');
      var q = new THREE.Quaternion().setFromEuler(euler);
      headBone.quaternion.copy(headOrigQuat).multiply(q);
    }

    if (spineBone) {
      if (!spineOrigQuat) spineOrigQuat = spineBone.quaternion.clone();
      var breathQ = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        Math.sin(t * 0.8) * 0.5 * DEG
      );
      spineBone.quaternion.copy(spineOrigQuat).multiply(breathQ);
    }

    renderer.render(scene, camera);
  }

  window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();
</script>
</body>
</html>`;
}
