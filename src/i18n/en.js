export default {
  appTitle: 'MicrometricPro',
  langLabel: 'Language',
  lengthMode: 'Length',
  circleMode: 'Circle / Stoma',
  reset: 'Reset',
  setA: 'Mark A',
  setB: 'Mark B',
  setC: 'Mark C',
  zoomOut: '− Zoom',
  zoomIn: '+ Zoom',
  nudgeLeft: '← 1 px',
  nudgeRight: '1 px →',
  nudgeUp: '↑ 1 px',
  nudgeDown: '1 px ↓',
  stomaCountLabel: 'Stomata count:',
  selectPhotoPrompt:
    'Select a photo. Drag the image to bring the measurement start point to the center.',
  helpText:
    'Length: select A and B. Circle/Stoma: select three spaced points A-B-C on the circle circumference; the center, diameter, area, and stomata/mm² are calculated automatically.',
  calibrationsLabel: 'Calibrations:',
  photoNotSelected: 'Select a photo.',
  imageDecodeFailed: 'Could not open the image.',
  scaleReadout: '{{objective}}× selected · scale: <b class="good">{{scale}} µm/pixel</b>',
  lengthReadout: 'A–B: <b>{{px}} px</b> → <b class="good">{{um}} µm</b>',
  circlePrompt:
    '{{objective}}× · Select three points on the circumference: A, B, and C. The center will be found automatically.',
  collinearWarning:
    '<span class="warn">The three points are too close to a straight line. Select point C elsewhere on the circumference.</span>',
  circleReadout:
    'Diameter: <b>{{diameter}} µm</b> · Radius: <b>{{radius}} µm</b> · Area: <b class="good">{{area}} mm²</b> · Stomata: <b>{{count}}</b> · Density: <b class="good">{{density}} stomata/mm²</b>',
  circleOutOfBounds: 'The entire field of view must fit inside the image.',
};
