
import * as React from 'react';

declare var ml5: any;

export interface IPoseProps {
}

export interface IPoseState {
    detected?: boolean
}

export default class Pose extends React.Component<IPoseProps, IPoseState> {
    private webCam: React.RefObject<HTMLVideoElement>;
    private camCanvas: React.RefObject<HTMLCanvasElement>;
    private stream: MediaStream;
    private poseNet: any;
    private HEIGHT: number;
    private WIDTH: number;
    private ctx: CanvasRenderingContext2D;
    private poses: any;
    private modelLoaded: boolean;
    private lastAngleData: any = null;

    constructor(props: IPoseProps) {
        super(props);
        this.webCam = React.createRef();
        this.camCanvas = React.createRef();
        this.HEIGHT = 700;
        this.WIDTH = 1000;
        this.modelLoaded = false;
        this.state = {
            detected: false
        };
    }

    initializeModel() {
        this.poseNet = ml5.poseNet(
            this.webCam.current, 
            { 
                flipHorizontal: false,
                maxPoseDetections: 1,
                scoreThreshold: .9,
            }, 
            () => {
            console.log("Model Initilaized");
            this.modelLoaded = true;
            this.poseNet.on('pose', (result: any) => {
                this.poses = result;

                this.setState({
                    detected: result !== undefined && result.length > 0 ? true : false
                })
            });
        });
    }

    drawKeypoints() {
        for (let i = 0; i < this.poses.length; i++) {
            let angleData = null;
            if(this.poses[i].pose.keypoints) {
                angleData = this.findElementPoints(
                    'leftShoulder',
                    'leftWrist',
                    'leftElbow',
                    this.poses[i].pose.keypoints
                )

                if(angleData) {
                    this.lastAngleData = angleData;
                }
                angleData = angleData || this.lastAngleData;
            }

            for (let j = 0; j < this.poses[i].pose.keypoints.length; j++) {
                let keypoint = this.poses[i].pose.keypoints[j];
                if (keypoint.score > 0.3) {
                    if(keypoint.part === 'leftElbow') {
                        this.ctx.fillStyle = "#ff5736";
                        this.ctx.font = "30px Arial";
                        if(angleData) {
                            this.ctx.fillText(`${keypoint.part} - ${Math.round(angleData.angle * 100)}*`, keypoint.position.x, keypoint.position.y);
                        } else {
                            this.ctx.fillText(keypoint.part, keypoint.position.x, keypoint.position.y);
                        }
                    } else {
                        this.ctx.fillStyle = "#349eeb";
                        this.ctx.font = "18px Arial";
                        this.ctx.fillText(keypoint.part, keypoint.position.x, keypoint.position.y);
                    }

                    this.ctx.beginPath();
                    this.ctx.arc(keypoint.position.x, keypoint.position.y, 5, 0, 2 * Math.PI);
                    this.ctx.fill();
                }
            }
        }
    }

    drawSkeleton() {
        this.poses.map(pose => {
            pose.skeleton.map(skeletonElement => {
                const partA = skeletonElement[0];
                const partB = skeletonElement[1];

                this.ctx.beginPath();
                this.ctx.moveTo(partA.position.x, partA.position.y);
                this.ctx.lineTo(partB.position.x, partB.position.y);
                this.ctx.stroke();
            });
        });
    }

    findElementPoints = (element1Name, element2Name, element3Name, keypoints) => {
        if(!keypoints || !Array.isArray(keypoints)) return null;

        // console.log(keypoints);
        const element1 = keypoints.find(keypoint => keypoint.part === element1Name);
        const element2 = keypoints.find(keypoint => keypoint.part === element2Name);
        const element3 = keypoints.find(keypoint => keypoint.part === element3Name);
        
        let response = null;
        if(element1 && element2 && element3) {
            // console.log(element1,  element2, element3);
            response = {
                [element1Name]: element1,
                [element2Name]: element2,
                [element3Name]: element3,
                angle: this.findAngle(element1.position, element2.position, element3.position)
            };

            // console.log(response);
        }

        return response
    }

    findAngle = (p0,p1,p2)  => {
        let a = Math.pow(p1.x-p0.x,2) + Math.pow(p1.y-p0.y,2);
        let b = Math.pow(p1.x-p2.x,2) + Math.pow(p1.y-p2.y,2);
        let c = Math.pow(p2.x-p0.x,2) + Math.pow(p2.y-p0.y,2);
        
        return Math.acos( (a+b-c) / Math.sqrt(4*a*b) );
    }

    drawCameraIntoCanvas() {
        if (this.modelLoaded) {
            this.ctx.drawImage(this.webCam.current, 0, 0, this.WIDTH, this.HEIGHT)
        }
        if (this.poses !== undefined) {
            this.drawKeypoints();
            this.drawSkeleton();
        }
        requestAnimationFrame(this.drawCameraIntoCanvas.bind(this));
    }

    componentDidMount() {
        this.ctx = this.camCanvas.current.getContext('2d');
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Browser API navigator.mediaDevices.getUserMedia not available');
        }

        navigator.mediaDevices
            .getUserMedia({
                'audio': false,
                'video': {
                    facingMode: 'user',
                    width: this.WIDTH,
                    height: this.HEIGHT,
                    frameRate: 15, // Reduce this if there's a stuttering in feed
                },
            }).then(res => {
                if (res != null) {
                    this.stream = res;
                    this.webCam.current!.srcObject = this.stream;
                    this.webCam.current?.play();

                    this.drawCameraIntoCanvas();
                    this.initializeModel();
                }
            });
    }

    componentWillUnmount() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
    }

    public render() {
        const camStyle: React.CSSProperties = {
            display: 'none'
        }

        return (
            <div className="container">
                {/* <h2>Posenet on ml5</h2> */}
                <canvas ref={this.camCanvas} width={this.WIDTH} height={this.HEIGHT} />
                <video playsInline ref={this.webCam} width={this.WIDTH} height={this.HEIGHT} style={camStyle} />
                {this.state.detected ? "Found You!!!" : "Show yourself"}
            </div>
        );
    }
}
