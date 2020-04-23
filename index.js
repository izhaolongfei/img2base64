/**
 * @file img2base64
 */

/* eslint-disable */
const actionTypes = ['ImageChanged', 'DrawFinish', 'DecodeComplete'];

export default class Img2Base64 {
    /**
     * options
     * @canvasId
     * @canvasSize {width, height}
     * @imgUrl http地址
     * @rotate 选装角度
     * @device {platform: ios／android, model: Honor}
     * @immediate 是否在画布绘制完后立刻导出图片base64
     */
    constructor(options = {}) {
        if (swan) {
            this.api = swan;
        } else if (wx) {
            this.api = wx;
        }
        const { canvasId, canvasSize, imgUrl = '', device = {}, immediate = false} = options;
        this.canvasId = canvasId;
        this.canvasSize = canvasSize;
        this.imgUrl = imgUrl;
        this.device = device;
        this.immediate = immediate;

        this.canvas = this.api.createCanvasContext(canvasId);

        this.imgUrl && this.setImage(this.imgUrl);

        if (swan && this._versionCompare(device.SDKVersion, '3.130.1') >= 0) {
            this.fs = this.api.getFileSystemManager();
        }
    }

    setImage(imgFilePath) {
        if (imgFilePath) {
            this.imgUrl = imgFilePath;
            this.onImageChanged && this.onImageChanged(imgFilePath);

            this.img = {
                path: imgFilePath
            };

            this._getImgSize(this.img)
                .then((img) => {
                    return this._getCanvasSize();
                })
                .then(_ => {
                    // this.canvas.save();
                    this._calcTarget();
                    this._drawTarget();
                    // this.canvas.restore();
                });
        } else {
            console.error('Error: setImage(imgUrl) imgUrl不能为空');
        }
    }

    getTargetRect() {
        return this.target;
    }

    getCanvasSize() {
        return this.canvasSize;
    }

    on(action, callback) {
        if (actionTypes.indexOf(action) > -1 && typeof (callback) === 'function') {
            this['on' + action] = callback;
        }
        return this;
    }

    _versionCompare(v1, v2) {
        if (v1 === v2) {
            return 0;
        }

        const v1v = v1.split('.');
        const v2v = v2.split('.');
        let flag = true;

        for (let i = 0; i < v1v.length; i++) {
            flag = flag && +v1v[i] >= +v2v[i];
        }

        return flag === true ? 1 : -1;
    }

    _getImgSize(img) {
        return new Promise(resolve => {
            if (img.width && img.height) {
                resolve(img);
            } else {
                this.api.getImageInfo({
                    src: img.path,
                    success: res => {
                        img.width = res.width;
                        img.height = res.height;
                        img.orientation = res.orientation;
                        // swan兼容
                        if (swan) {
                            if (this.device.platform === 'ios' && res.orientation === 'right') {
                                // 接口有问题，做兼容
                                img.width = res.height;
                                img.height = res.width;
                                img.orientation = 'left';
                            }
                            if (this.device.model === 'SM-N950F' && res.orientation === 'left') {
                                // 三星
                                img.width = res.height;
                                img.height = res.width;
                            }
                        }
                        img.ratio = img.height / img.width;
                        resolve(img);
                    },
                    fail(e) {
                        reject(e);
                    }
                });
            }
        });
    }

    _getCanvasSize() {
        return new Promise(resolve => {
            if (this.canvasSize) {
                this.canvasSize.ratio = this.canvasSize.height / this.canvasSize.width,
                resolve();
            } else {
                this.api.createSelectorQuery().select('#' + this.canvasId).boundingClientRect((res) => {
                    this.canvasSize = {
                        ratio: res.height / res.width,
                        width: res.width,
                        height: res.height
                    };
                    resolve();
                }).exec();
            }
        });
    }

    _calcTarget() {
        const dir2degree = {
            'up': 0,
            'left': 90,
            'right': -90,
            'down': 180
        };
        this.rotate = dir2degree[this.img.orientation] || 0;

        let tmpCanvas = {
            width: this.canvasSize.width,
            height: this.canvasSize.height,
            ratio: this.canvasSize.ratio
        }
        if (Math.abs(this.rotate) === 90) {
            tmpCanvas = {
                width: this.canvasSize.height,
                height: this.canvasSize.width,
                ratio: 1 / this.canvasSize.ratio
            };
        }

        let width = 0;
        let height = 0;
        let translateX = 0;
        let translateY = 0;

        if (this.img.ratio <= tmpCanvas.ratio) {
            width = tmpCanvas.width;
            height = width * this.img.ratio;
        } else {
            height = tmpCanvas.height;
            width = Math.floor(height / this.img.ratio);
        }

        if (this.rotate === 90) {
            translateX = height;
            translateY = 0;
        } else if (this.rotate === -90) {
            translateX = 0;
            translateY = width;
        } else if (this.rotate === 180) {
            translateX = height;
            translateY = width;
        }

        // 画笔移动到目标点，从 (0,0) 开始绘制即可
        this.target = {
            width: width,
            height: height,
            top: 0,
            left: 0
        };

        this.canvas.translate(translateX, translateY);
        this.canvas.rotate(this.rotate * Math.PI / 180);
    }

    _drawTarget() {
        this.canvas.drawImage(this.img.path, this.target.left, this.target.top, this.target.width, this.target.height);
        this.canvas.draw(false, _ => {
            let target = {
                x: 0,
                y: 0,
                width: this.target.width,
                height: this.target.height
            };
            if (Math.abs(this.rotate) === 90) {
                const w = target.width;
                target.width = target.height;
                target.height = w;
                 // 矫正后的实际宽高
                this.target._width = this.target.height;
                this.target._height = this.target.width;
            } else {
                this.target._width = this.target.width;
                this.target._height = this.target.height;
            }
            this.onDrawFinish && this.onDrawFinish(target);
            this.immediate && this._decodeTarget();
        });
    }

    /**
     * 导出某一部分
     * @param {object} rect {left, top, right, bottom} 百分比
     */
    decodeRect(rect) {        
        this._decodeTarget(rect);
    }

    _decodeTarget(rect) {
        this._getTargetImgData(rect)
            .then((res) => {
                return this._toBase64(res);
            })
            .then((base64) => {
                this.onDecodeComplete && this.onDecodeComplete({
                    code: 0,
                    data: base64
                })
            })
            .catch(error => {
                this.onDecodeComplete && this.onDecodeComplete(error)
            });
    }

    /**
     * 导出图片
     * @param {object} rect {left, top, right, bottom}
     */
    _getTargetImgData(rect) {
        return new Promise((resolve, reject) => {
            let target = {
                left: this.target.left,
                top: this.target.top,
                width: this.target._width,
                height: this.target._height
            };

            if (rect) {
                if (rect.left < 0) {
                    rect.left = 0;
                }
                if (rect.top < 0) {
                    rect.top = 0;
                }
                target = {
                    left: this.target._width * rect.left,
                    top: this.target._height * rect.top,
                    width: this.target._width * (rect.right - rect.left),
                    height: this.target._width * (rect.bottom - rect.top)
                };
                if (target.left + target.width > this.target._width) {
                    target.width = this.target._width - target.left;
                }
                if (target.top + target.height > this.target._height) {
                    target.height = this.target._height - target.top;
                }
            }

            const excoords = {
                x: Math.abs(target.left),
                y: Math.abs(target.top),
                width: Math.abs(target.width),
                height: Math.abs(target.height)
            };

            if (this.fs) {
                this.api.canvasToTempFilePath({
                    canvasId: this.canvasId,
                    ...excoords,
                    fileType: 'jpg',
                    quality: 0.8,
                    success: res => {
                        resolve({
                            type: 'image',
                            data: res.tempFilePath
                        })
                    },
                    fail: err => {
                        reject({
                            code: 1,
                            msg: err
                        });
                    }
                })
            } else {
                this.api.canvasGetImageData({
                    canvasId: this.canvasId,
                    ...excoords,
                    success(res) {
                        resolve({
                            type: 'buffer',
                            data: res
                        })
                    },
                    fail(err) {
                        reject({
                            code: 1,
                            msg: err
                        });
                    }
                });             
            }
        });
    }

    // 上下颠倒
    _reverseImgData(res) {
        let w = res.width;
        let h = res.height;
        let con = 0;
        for (let i = 0; i < h / 2; i++) {
            for (let j = 0; j < w * 4; j++) {
                con = res.data[i * w * 4 + j];
                res.data[i * w * 4 + j] = res.data[(h - i - 1) * w * 4 + j];
                res.data[(h - i - 1) * w * 4 + j] = con;
            }
        }
        return res;
    }

    _toBase64(source) {
        return new Promise((resolve, reject) => {
            try {
                if (source.type === 'buffer') {
                    const base64 = btoa(source.data.reduce(function (str, byte) {
                        return str + String.fromCharCode(byte);
                    }, ''));

                    resolve(base64);
                } else if (source.type === 'image') {
                    this.fs.readFile({
                        filePath: source.data,
                        encoding: 'base64',
                        success: res => {
                            resolve(res.data);
                        },
                        fail: err => {
                            reject({
                                code: 2,
                                msg: err
                            })
                        }
                    });
                }
            } catch (e) {
                reject({
                    code: 2,
                    msg: e
                });
            }
        });
    }
}
