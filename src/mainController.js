const EventEmitter = require('events');
const SerialPort = require('serialport');
const cobs = require('cobs');
const robotlib = require('robotlib');
const Parser = require('./Parser');

/**
 * MainController
 * @param {String} path
 * @return {Object}
 */
const mainController = (path) => {
  const eventEmitter = new EventEmitter();
  const requestStartFlag = 0xA3;

  let port;
  let parser;

  /**
   * Constructor
   */
  function constructor() {}

  /**
   * Init
   * @return {Promise}
   */
  function init() {
    return new Promise((resolve, reject) => {
      if (port) {
        setTimeout(reject, 0);
      }

      port = new SerialPort(path, { baudRate: 115200 });
      parser = new Parser();

      port.pipe(parser);

      port.on('error', error => eventEmitter.emit('error', error));
      port.on('disconnect', () => eventEmitter.emit('disconnect'));
      port.on('close', () => eventEmitter.emit('close'));
      port.on('open', onPortOpen);

      parser.on('ready', resolve);
      parser.on('odometry', data => eventEmitter.emit('odometry', data));
      parser.on('targetReached', data => eventEmitter.emit('targetReached', data));
    });
  }

  /**
   * Forward
   * @param {Number} speed
   * @param {Number} distance
   * @return {Promise}
   */
  function forward(speed, distance = 0) {
    const speedByte = robotlib.utils.math.numberToHex(speed);
    const distanceByte = robotlib.utils.math.numberToHex(distance);

    writeToSerialPort([requestStartFlag, 0x10, speedByte, distanceByte]);

    if (distance) {
      return new Promise((resolve) => {
        const onTargetReached = () => {
          parser.off('targetReached', onTargetReached);
          resolve();
        };

        parser.on('targetReached', onTargetReached);
      });
    }
  }

  /**
   * Reverse
   * @param {Number} speed
   * @param {Number} distance
   * @return {Promise}
   */
  function reverse(speed, distance = 0) {
    const speedByte = robotlib.utils.math.numberToHex(speed);
    const distanceByte = robotlib.utils.math.numberToHex(distance);

    writeToSerialPort([requestStartFlag, 0x11, speedByte, distanceByte]);

    if (distance) {
      return new Promise((resolve) => {
        const onTargetReached = () => {
          parser.off('targetReached', onTargetReached);
          resolve();
        };

        parser.on('targetReached', onTargetReached);
      });
    }
  }

  /**
   * Rotate
   * @param {Number} speed
   * @param {Number} angle [-180 / 180]
   * @return {Promise}
   */
  function rotate(speed, angle) {
    const speedByte = robotlib.utils.math.numberToHex(speed);
    const angleByte = robotlib.utils.math.numberToHex(Math.abs(angle));
    const directionByte = robotlib.utils.math.numberToHex(angle < 0 ? 0 : 1);

    writeToSerialPort([requestStartFlag, 0x12, speedByte, angleByte, directionByte]);

    return new Promise((resolve) => {
      const onTargetReached = () => {
        parser.off('targetReached', onTargetReached);
        resolve();
      };

      parser.on('targetReached', onTargetReached);
    });
  }

  /**
   * Turn
   * @param {Number} speed
   * @param {Number} angle [-180 / 180]
   * @param {Number} radius
   * @return {Promise}
   */
  function turn(speed, angle, radius) {
    const speedByte = robotlib.utils.math.numberToHex(speed);
    const angleByte = robotlib.utils.math.numberToHex(Math.abs(angle));
    const radiusByte = robotlib.utils.math.numberToHex(radius);
    const directionByte = robotlib.utils.math.numberToHex(angle < 0 ? 0 : 1);

    writeToSerialPort([requestStartFlag, 0x13, speedByte, angleByte, radiusByte, directionByte]);

    return new Promise((resolve) => {
      const onTargetReached = () => {
        parser.off('targetReached', onTargetReached);
        resolve();
      };

      parser.on('targetReached', onTargetReached);
    });
  }

  /**
   * Drive
   * @param {Number} speedLeft
   * @param {Number} speedRight
   */
  function drive(speedLeft, speedRight) {
    const speedLeftByte = robotlib.utils.math.numberToHex(speedLeft);
    const speedRightByte = robotlib.utils.math.numberToHex(speedRight);

    writeToSerialPort([requestStartFlag, 0x14, speedLeftByte, speedRightByte]);
  }

  /**
   * Stop
   * @param {Number} hard
   * @return {Promise}
   */
  function stop(hard = 0) {
    return new Promise((resolve) => {
      writeToSerialPort([requestStartFlag, 0x15, robotlib.utils.math.numberToHex(hard)]);
      setTimeout(resolve, hard ? 0 : 1000);
    });
  }

  /**
   * Writes the given buffer to the serial port
   * @param {Array} data
   */
  function writeToSerialPort(data) {
    port.write(cobs.encode(Buffer.from(data), true));
  };

  /**
   * Port open event handler
   */
  function onPortOpen() {
    port.flush(error => {
      if (error) {
        eventEmitter.emit('error', error);
      }
    });
  }

  constructor();

  return {
    init,
    forward,
    reverse,
    rotate,
    turn,
    drive,
    stop,
    on: eventEmitter.on.bind(eventEmitter),
    off: eventEmitter.off.bind(eventEmitter),
  };
};

module.exports = mainController;
