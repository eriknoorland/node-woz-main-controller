const Transform = require('stream').Transform;
const cobs = require('cobs');
const odometryParser = require('./parsers/odometry');
const numDescriptorBytes = 4;

/**
 * Parser
 */
class Parser extends Transform {
  /**
   * Constructor
   */
  constructor() {
    super();

    this.startFlags = Buffer.from([0xA3, 0x3A]);
    this.buffer = Buffer.alloc(0);
  }

  /**
   * Transform
   * @param {Buffer} chunk
   * @param {String} encoding
   * @param {Function} callback
   */
  _transform(chunk, encoding, callback) {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    for (let j = 0; j < this.buffer.length; j++) {
      if (this.buffer.indexOf(this.startFlags, 0, 'hex') !== -1) {
        const packetStart = this.buffer.indexOf(this.startFlags, 0, 'hex') - 1;

        if (this.buffer.length > packetStart + numDescriptorBytes) {
          const command = this.buffer[packetStart + 3];
          const dataLength = this.buffer[packetStart + 4];

          if (this.buffer.length > packetStart + numDescriptorBytes + dataLength + 1) {
            const packetEnd = packetStart + numDescriptorBytes + dataLength + 1;
            const packet = this.buffer.slice(packetStart, packetEnd);
            const decodedPacket = cobs.decode(packet);
            const packetData = [];

            this.buffer = this.buffer.slice(packetEnd);
            j = 0;

            for (let i = 0; i < dataLength; i++) {
              const index = numDescriptorBytes + i;
              packetData.push(decodedPacket[index]);
            }

            switch(command) {
              case 0xFF:
                this.emit('ready');
                break;

              case 0x10:
              case 0x11:
              case 0x12:
              case 0x13:
                this.emit('targetReached');
                break;

              case 0x30:
                this.emit('odometry', odometryParser(packetData));
                break;
            }
          }
        }
      }
    }

    callback();
  }
}

module.exports = Parser;
