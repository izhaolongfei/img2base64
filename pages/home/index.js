/* eslint-disable */
import Img2Base64 from '../../utils/img2base64.js';

const app = getApp();

Page({

    /**
     * 页面的初始数据
     */
    data: {
        base64Img: '',
        localImg: ''
    },

    go2upload(e) {
        swan.chooseImage({
            count: 1,
            sizeType: ['original'],  // ['compressed'],  // 压缩图拿不到图片旋转方向
            sourceType: ['album', 'camera'],
            success: res => {
                const tmpImg = res.tempFilePaths[0];

                swan.getImageInfo({
                    src: tmpImg,
                    success: res => {
                        this.querying(tmpImg);
                    },
                    fail: err => {
                    }
                });
            }
        });
    },

    querying(imgUrl) {
        swan.showLoading({
            title: '开始解析...',
            mask: true
        });

        this.q = new Img2Base64({canvasId: 'squareCanvas', imgUrl: imgUrl})
            .on('DrawFinish', target => {
                swan.showToast({
                    title: '图片绘制结束'
                });
            })
            .on('DecodeComplete', res => {
                swan.hideLoading();

                if (res.code == 0) {
                    this.setData({
                        base64Img: 'data:image/jpeg;base64,' + res.data
                    });

                    // 导出图片
                    swan.canvasToTempFilePath({
                        canvasId: 'squareCanvas',
                        success: res => {
                            this.setData({
                                localImg: res.tempFilePath
                            });
                        },
                        fail: err => {
                        }
                    });
                } else {
                    this.showToast('解析失败');
                }
            });
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad: function (options) {
    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady: function () {
    },

    /**
     * 生命周期函数--监听页面显示
     */
    onShow: function () {
    },

    /**
     * 生命周期函数--监听页面隐藏
     */
    onHide: function () {
    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload: function () {
    },

    /**
     * 页面相关事件处理函数--监听用户下拉动作
     */
    onPullDownRefresh: function () {
    },

    /**
     * 页面上拉触底事件的处理函数
     */
    onReachBottom: function () {
    },

    /**
     * 用户点击右上角分享
     */
    onShareAppMessage: function () {
    }
});