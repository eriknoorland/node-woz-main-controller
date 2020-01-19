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
   * Go to point
   * @param {Object} currentPosition
   * @param {Object} targetPosition
   * @param {Number} currentHeading
   * @return {Promise}
   */
  function goToXY(currentPosition, targetPosition, currentHeading) {
    const { x: x1, y: y1 } = currentPosition;
    const { x: x2, y: y2 } = targetPosition;
    const distance = Math.round(Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)));
    const angleRadians = Math.atan2(y2 - y1, x2 - x1);
    const angle = Math.round(robotlib.utils.math.rad2deg(angleRadians));
    const rotateAngle = robotlib.utils.math.getRelativeAngleDifference(angle, currentHeading);

    return new Promise(async (resolve) => {
      if (rotateAngle) {
        await rotate(20, rotateAngle);
      }

      await forward(20, distance);

      resolve();
    });
  }

  /**
   * Keep heading
   * @param {Number} speed
   * @param {Number} heading
   * @param {Number} distance
   * @return {Promise}
   */
  function keepHeading(speed, heading, distance = 0) {
    const speedByte = robotlib.utils.math.numberToHex(Math.abs(speed));
    const headingByte = robotlib.utils.math.numberToHex(heading);
    const directionByte = robotlib.utils.math.numberToHex(speed > 0 ? 1 : 0);
    const distanceByte = robotlib.utils.math.numberToHex(distance);

    writeToSerialPort([requestStartFlag, 0x16, speedByte, headingByte, directionByte, distanceByte]);

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
    const directionByte = robotlib.utils.math.numberToHex(angle < 0 ? 1 : 0);

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
    const directionByte = robotlib.utils.math.numberToHex(angle < 0 ? 1 : 0);

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
   * Reset the IMU
   */
  function resetIMU() {
    return new Promise((resolve) => {
      writeToSerialPort([requestStartFlag, 0x20]);
      setTimeout(resolve, 1000);
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
    goToXY,
    keepHeading,
    forward,
    reverse,
    rotate,
    turn,
    drive,
    stop,
    resetIMU,
    on: eventEmitter.on.bind(eventEmitter),
    off: eventEmitter.off.bind(eventEmitter),
  };
};

module.exports = mainController;
