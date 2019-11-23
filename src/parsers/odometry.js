const robotlib = require('../../../../node-robotlib'); // FIXME require as node_modules dependency
const parseDecToBinary = robotlib.utils.math.parseDecToBinary;

/**
 *
 * @param {Array} data
 * @return {Object}
 */
const odometry = (data) => {
  const leftMotorDirection = data[0] || -1;
  const deltaLeftTicks = data[1];
  const rightMotorDirection = data[2] || -1;
  const deltaRightTicks = data[3];
  const headingPartMsb = data[4];
  const headingPartLsb = data[5];
  const heading = parseInt(`${parseDecToBinary(headingPartMsb)}${parseDecToBinary(headingPartLsb)}`, 2) / 100;

  return {
    leftTicks: deltaLeftTicks * leftMotorDirection,
    rightTicks: deltaRightTicks * rightMotorDirection,
    heading,
  };
};

module.exports = odometry;
