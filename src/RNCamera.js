// @flow
import React from 'react';
import PropTypes from 'prop-types';
import { mapValues } from 'lodash';
import {
  findNodeHandle,
  Platform,
  NativeModules,
  ViewPropTypes,
  requireNativeComponent,
  View,
  Text,
  StyleSheet,
} from 'react-native';

import { requestPermissions } from './handlePermissions';
import type { FaceFeature } from './FaceDetector';

const Rationale = PropTypes.shape({
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  buttonPositive: PropTypes.string,
  buttonNegative: PropTypes.string,
  buttonNeutral: PropTypes.string,
});

const styles = StyleSheet.create({
  authorizationContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notAuthorizedText: {
    textAlign: 'center',
    fontSize: 16,
  },
});

type Orientation = 'auto' | 'landscapeLeft' | 'landscapeRight' | 'portrait' | 'portraitUpsideDown';

type PictureOptions = {
  quality?: number,
  orientation?: Orientation,
  base64?: boolean,
  mirrorImage?: boolean,
  exif?: boolean,
  writeExif?: boolean | { [name: string]: any },
  width?: number,
  fixOrientation?: boolean,
  forceUpOrientation?: boolean,
  pauseAfterCapture?: boolean,
};

type TrackedFaceFeature = FaceFeature & {
  faceID?: number,
};

type TrackedTextFeature = {
  type: string,
  bounds: {
    size: {
      width: number,
      height: number,
    },
    origin: {
      x: number,
      y: number,
    },
  },
  value: string,
  components: Array<TrackedTextFeature>,
};

type TrackedBarcodeFeature = {
  bounds: {
    size: {
      width: number,
      height: number,
    },
    origin: {
      x: number,
      y: number,
    },
  },
  data: string,
  dataRaw: string,
  type: BarcodeType,
  format?: string,
  addresses?: {
    addressesType?: 'UNKNOWN' | 'Work' | 'Home',
    addressLines?: string[],
  }[],
  emails?: Email[],
  phones?: Phone[],
  urls: ?(string[]),
  name?: {
    firstName?: string,
    lastName?: string,
    middleName?: string,
    prefix?: string,
    pronounciation?: string,
    suffix?: string,
    formattedName?: string,
  },
  phone?: Phone,
  organization?: string,
  latitude?: number,
  longitude?: number,
  ssid?: string,
  password?: string,
  encryptionType?: string,
  title?: string,
  url?: string,
  firstName?: string,
  middleName?: string,
  lastName?: string,
  gender?: string,
  addressCity?: string,
  addressState?: string,
  addressStreet?: string,
  addressZip?: string,
  birthDate?: string,
  documentType?: string,
  licenseNumber?: string,
  expiryDate?: string,
  issuingDate?: string,
  issuingCountry?: string,
  eventDescription?: string,
  location?: string,
  organizer?: string,
  status?: string,
  summary?: string,
  start?: string,
  end?: string,
  email?: Email,
  phoneNumber?: string,
  message?: string,
};

type BarcodeType =
  | 'EMAIL'
  | 'PHONE'
  | 'CALENDAR_EVENT'
  | 'DRIVER_LICENSE'
  | 'GEO'
  | 'SMS'
  | 'CONTACT_INFO'
  | 'WIFI'
  | 'TEXT'
  | 'ISBN'
  | 'PRODUCT'
  | 'URL';

type Email = {
  address?: string,
  body?: string,
  subject?: string,
  emailType?: 'UNKNOWN' | 'Work' | 'Home',
};

type Phone = {
  number?: string,
  phoneType?: 'UNKNOWN' | 'Work' | 'Home' | 'Fax' | 'Mobile',
};

type RecordingOptions = {
  maxDuration?: number,
  maxFileSize?: number,
  orientation?: Orientation,
  quality?: number | string,
  fps?: number,
  codec?: string,
  mute?: boolean,
  path?: string,
};

type EventCallbackArgumentsType = {
  nativeEvent: Object,
};

type Rect = {
  x: number,
  y: number,
  width: number,
  height: number,
};

type PropsType = typeof View.props & {
  zoom?: number,
  useNativeZoom?: boolean,
  maxZoom?: number,
  ratio?: string,
  focusDepth?: number,
  type?: number | string,
  onCameraReady?: Function,
  onAudioInterrupted?: Function,
  onAudioConnected?: Function,
  onBarCodeRead?: Function,
  onPictureTaken?: Function,
  onPictureSaved?: Function,
  onRecordingStart?: Function,
  onRecordingEnd?: Function,
  onTap?: Function,
  onDoubleTap?: Function,
  onGoogleVisionBarcodesDetected?: ({ barcodes: Array<TrackedBarcodeFeature> }) => void,
  onSubjectAreaChanged?: ({ nativeEvent: { prevPoint: {| x: number, y: number |} } }) => void,
  faceDetectionMode?: number,
  trackingEnabled?: boolean,
  flashMode?: number | string,
  exposure?: number,
  barCodeTypes?: Array<string>,
  googleVisionBarcodeType?: number,
  googleVisionBarcodeMode?: number,
  whiteBalance?:
    | number
    | string
    | {
        temperature: number,
        tint: number,
        redGainOffset?: number,
        greenGainOffset?: number,
        blueGainOffset?: number,
      },
  faceDetectionLandmarks?: number,
  autoFocus?: string | boolean | number,
  autoFocusPointOfInterest?: { x: number, y: number },
  faceDetectionClassifications?: number,
  onFacesDetected?: ({ faces: Array<TrackedFaceFeature> }) => void,
  onTextRecognized?: ({ textBlocks: Array<TrackedTextFeature> }) => void,
  captureAudio?: boolean,
  keepAudioSession?: boolean,
  useCamera2Api?: boolean,
  playSoundOnCapture?: boolean,
  playSoundOnRecord?: boolean,
  videoStabilizationMode?: number | string,
  pictureSize?: string,
  rectOfInterest: Rect,
};

type StateType = {
  isAuthorized: boolean,
  isAuthorizationChecked: boolean,
};

type Status = 'READY' | 'PENDING_AUTHORIZATION' | 'NOT_AUTHORIZED';

const CameraStatus: { [key: Status]: Status } = {
  READY: 'READY',
  PENDING_AUTHORIZATION: 'PENDING_AUTHORIZATION',
  NOT_AUTHORIZED: 'NOT_AUTHORIZED',
};

const CameraManager: Object = NativeModules.RNCameraManager ||
  NativeModules.RNCameraModule || {
    stubbed: true,
    Type: {
      back: 1,
    },
    AutoFocus: {
      on: 1,
    },
    FlashMode: {
      off: 1,
    },
    WhiteBalance: {},
    BarCodeType: {},
    FaceDetection: {
      fast: 1,
      Mode: {},
      Landmarks: {
        none: 0,
      },
      Classifications: {
        none: 0,
      },
    },
    GoogleVisionBarcodeDetection: {
      BarcodeType: 0,
      BarcodeMode: 0,
    },
  };

const EventThrottleMs = 500;

export default class Camera extends React.Component<PropsType, StateType> {
  static Constants = {
    Type: CameraManager.Type,
    FlashMode: CameraManager.FlashMode,
    AutoFocus: CameraManager.AutoFocus,
    WhiteBalance: CameraManager.WhiteBalance,
    VideoQuality: CameraManager.VideoQuality,
    ImageType: CameraManager.ImageType,
    VideoCodec: CameraManager.VideoCodec,
    BarCodeType: CameraManager.BarCodeType,
    GoogleVisionBarcodeDetection: CameraManager.GoogleVisionBarcodeDetection,
    FaceDetection: CameraManager.FaceDetection,
    CameraStatus,
    CaptureTarget: CameraManager.CaptureTarget,
    VideoStabilization: CameraManager.VideoStabilization,
  };

  // Values under keys from this object will be transformed to native options
  static ConversionTables = {
    type: CameraManager.Type,
    flashMode: CameraManager.FlashMode,
    exposure: CameraManager.Exposure,
    autoFocus: CameraManager.AutoFocus,
    whiteBalance: CameraManager.WhiteBalance,
    faceDetectionMode: (CameraManager.FaceDetection || {}).Mode,
    faceDetectionLandmarks: (CameraManager.FaceDetection || {}).Landmarks,
    faceDetectionClassifications: (CameraManager.FaceDetection || {}).Classifications,
    googleVisionBarcodeType: (CameraManager.GoogleVisionBarcodeDetection || {}).BarcodeType,
    googleVisionBarcodeMode: (CameraManager.GoogleVisionBarcodeDetection || {}).BarcodeMode,
    videoStabilizationMode: CameraManager.VideoStabilization || {},
  };

  static propTypes = {
    ...ViewPropTypes,
    zoom: PropTypes.number,
    useNativeZoom: PropTypes.bool,
    maxZoom: PropTypes.number,
    ratio: PropTypes.string,
    focusDepth: PropTypes.number,
    onMountError: PropTypes.func,
    onCameraReady: PropTypes.func,
    onAudioInterrupted: PropTypes.func,
    onAudioConnected: PropTypes.func,
    onBarCodeRead: PropTypes.func,
    onPictureTaken: PropTypes.func,
    onPictureSaved: PropTypes.func,
    onRecordingStart: PropTypes.func,
    onRecordingEnd: PropTypes.func,
    onTap: PropTypes.func,
    onDoubleTap: PropTypes.func,
    onGoogleVisionBarcodesDetected: PropTypes.func,
    onFacesDetected: PropTypes.func,
    onTextRecognized: PropTypes.func,
    onSubjectAreaChanged: PropTypes.func,
    trackingEnabled: PropTypes.bool,
    faceDetectionMode: PropTypes.number,
    faceDetectionLandmarks: PropTypes.number,
    faceDetectionClassifications: PropTypes.number,
    barCodeTypes: PropTypes.arrayOf(PropTypes.string),
    googleVisionBarcodeType: PropTypes.number,
    googleVisionBarcodeMode: PropTypes.number,
    type: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    cameraId: PropTypes.string,
    flashMode: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    exposure: PropTypes.number,
    whiteBalance: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
      PropTypes.shape({
        temperature: PropTypes.number,
        tint: PropTypes.number,
        redGainOffset: PropTypes.number,
        greenGainOffset: PropTypes.number,
        blueGainOffset: PropTypes.number,
      }),
    ]),
    autoFocus: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.bool]),
    autoFocusPointOfInterest: PropTypes.shape({ x: PropTypes.number, y: PropTypes.number }),
    permissionDialogTitle: PropTypes.string,
    permissionDialogMessage: PropTypes.string,
    androidCameraPermissionOptions: Rationale,
    androidRecordAudioPermissionOptions: Rationale,
    notAuthorizedView: PropTypes.element,
    pendingAuthorizationView: PropTypes.element,
    captureAudio: PropTypes.bool,
    keepAudioSession: PropTypes.bool,
    useCamera2Api: PropTypes.bool,
    playSoundOnCapture: PropTypes.bool,
    playSoundOnRecord: PropTypes.bool,
    videoStabilizationMode: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    pictureSize: PropTypes.string,
    mirrorVideo: PropTypes.bool,
    rectOfInterest: PropTypes.any,
    defaultVideoQuality: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  };

  static defaultProps: Object = {
    zoom: 0,
    useNativeZoom: false,
    maxZoom: 0,
    ratio: '4:3',
    focusDepth: 0,
    type: CameraManager.Type.back,
    cameraId: null,
    autoFocus: CameraManager.AutoFocus.on,
    flashMode: CameraManager.FlashMode.off,
    exposure: -1,
    whiteBalance: CameraManager.WhiteBalance.auto,
    faceDetectionMode: (CameraManager.FaceDetection || {}).fast,
    barCodeTypes: Object.values(CameraManager.BarCodeType),
    googleVisionBarcodeType: ((CameraManager.GoogleVisionBarcodeDetection || {}).BarcodeType || {})
      .None,
    googleVisionBarcodeMode: ((CameraManager.GoogleVisionBarcodeDetection || {}).BarcodeMode || {})
      .NORMAL,
    faceDetectionLandmarks: ((CameraManager.FaceDetection || {}).Landmarks || {}).none,
    faceDetectionClassifications: ((CameraManager.FaceDetection || {}).Classifications || {}).none,
    permissionDialogTitle: '',
    permissionDialogMessage: '',
    androidCameraPermissionOptions: null,
    androidRecordAudioPermissionOptions: null,
    notAuthorizedView: (
      <View style={styles.authorizationContainer}>
        <Text style={styles.notAuthorizedText}>Camera not authorized</Text>
      </View>
    ),
    pendingAuthorizationView: <View style={styles.authorizationContainer}></View>,
    captureAudio: false,
    keepAudioSession: false,
    useCamera2Api: false,
    playSoundOnCapture: false,
    playSoundOnRecord: false,
    pictureSize: 'None',
    videoStabilizationMode: 0,
    mirrorVideo: false,
  };

  _cameraRef: ?Object;
  _cameraHandle: ?number;
  _lastEvents: { [string]: string };
  _lastEventsTimes: { [string]: Date };
  _isMounted: boolean;

  constructor(props: PropsType) {
    super(props);
    this._lastEvents = {};
    this._lastEventsTimes = {};
    this._isMounted = true;
    this.state = {
      isAuthorized: false,
      isAuthorizationChecked: false,
    };
  }

  async takePictureAsync(options?: PictureOptions) {
    if (!options) {
      options = {};
    }
    if (!options.quality) {
      options.quality = 1;
    }

    if (options.orientation) {
      options.orientation = CameraManager.Orientation[options.orientation];
    }

    if (options.pauseAfterCapture === undefined) {
      options.pauseAfterCapture = false;
    }

    if (!this._cameraHandle) {
      throw 'Camera handle cannot be null';
    }

    return await CameraManager.takePicture(options, this._cameraHandle);
  }

  async getSupportedRatiosAsync() {
    if (Platform.OS === 'android') {
      return await CameraManager.getSupportedRatios(this._cameraHandle);
    } else {
      throw new Error('Ratio is not supported on iOS');
    }
  }

  async getCameraIdsAsync() {
    if (Platform.OS === 'android') {
      return await CameraManager.getCameraIds(this._cameraHandle);
    } else {
      return await CameraManager.getCameraIds(); // iOS does not need a camera instance
    }
  }

  getSupportedPreviewFpsRange = async (): Promise<[]> => {
    if (Platform.OS === 'android') {
      return await CameraManager.getSupportedPreviewFpsRange(this._cameraHandle);
    } else {
      throw new Error('getSupportedPreviewFpsRange is not supported on iOS');
    }
  };

  getAvailablePictureSizes = async (): string[] => {
    //$FlowFixMe
    return await CameraManager.getAvailablePictureSizes(this.props.ratio, this._cameraHandle);
  };

  async recordAsync(options?: RecordingOptions) {
    if (!options || typeof options !== 'object') {
      options = {};
    } else if (typeof options.quality === 'string') {
      options.quality = Camera.Constants.VideoQuality[options.quality];
    }
    if (typeof options.orientation === 'string') {
      options.orientation = CameraManager.Orientation[options.orientation];
    }
    return await CameraManager.record(options, this._cameraHandle);
  }

  stopRecording() {
    CameraManager.stopRecording(this._cameraHandle);
  }

  pauseRecording() {
    CameraManager.pauseRecording(this._cameraHandle);
  }

  resumeRecording() {
    CameraManager.resumeRecording(this._cameraHandle);
  }

  pausePreview() {
    CameraManager.pausePreview(this._cameraHandle);
  }

  resumePreview() {
    CameraManager.resumePreview(this._cameraHandle);
  }

  _onMountError = ({ nativeEvent }: EventCallbackArgumentsType) => {
    if (this.props.onMountError) {
      this.props.onMountError(nativeEvent);
    }
  };

  _onCameraReady = () => {
    if (this.props.onCameraReady) {
      this.props.onCameraReady();
    }
  };

  _onAudioInterrupted = () => {
    if (this.props.onAudioInterrupted) {
      this.props.onAudioInterrupted();
    }
  };
  _onTouch = ({ nativeEvent }: EventCallbackArgumentsType) => {
    if (this.props.onTap && !nativeEvent.isDoubleTap) {
      this.props.onTap(nativeEvent.touchOrigin);
    }
    if (this.props.onDoubleTap && nativeEvent.isDoubleTap) {
      this.props.onDoubleTap(nativeEvent.touchOrigin);
    }
  };
  _onAudioConnected = () => {
    if (this.props.onAudioConnected) {
      this.props.onAudioConnected();
    }
  };

  _onPictureSaved = ({ nativeEvent }: EventCallbackArgumentsType) => {
    if (this.props.onPictureSaved) {
      this.props.onPictureSaved(nativeEvent);
    }
  };

  _onObjectDetected = (callback: ?Function) => ({ nativeEvent }: EventCallbackArgumentsType) => {
    const { type } = nativeEvent;
    if (
      this._lastEvents[type] &&
      this._lastEventsTimes[type] &&
      JSON.stringify(nativeEvent) === this._lastEvents[type] &&
      new Date() - this._lastEventsTimes[type] < EventThrottleMs
    ) {
      return;
    }

    if (callback) {
      callback(nativeEvent);
      this._lastEventsTimes[type] = new Date();
      this._lastEvents[type] = JSON.stringify(nativeEvent);
    }
  };

  _onSubjectAreaChanged = (e) => {
    if (this.props.onSubjectAreaChanged) {
      this.props.onSubjectAreaChanged(e);
    }
  };

  _setReference = (ref: ?Object) => {
    if (ref) {
      this._cameraRef = ref;
      this._cameraHandle = findNodeHandle(ref);
    } else {
      this._cameraRef = null;
      this._cameraHandle = null;
    }
  };

  componentWillUnmount() {
    this._isMounted = false;
  }

  async componentDidMount() {
    const hasVideoAndAudio = this.props.captureAudio;
    const isAuthorized = await requestPermissions(
      hasVideoAndAudio,
      CameraManager,
      this.props.permissionDialogTitle,
      this.props.permissionDialogMessage,
    );

    if (this._isMounted === false) {
      return;
    }

    this.setState({ isAuthorized, isAuthorizationChecked: true });
  }

  getStatus = (): Status => {
    const { isAuthorized, isAuthorizationChecked } = this.state;
    if (isAuthorizationChecked === false) {
      return CameraStatus.PENDING_AUTHORIZATION;
    }
    return isAuthorized ? CameraStatus.READY : CameraStatus.NOT_AUTHORIZED;
  };

  // FaCC = Function as Child Component;
  hasFaCC = (): * => typeof this.props.children === 'function';

  renderChildren = (): * => {
    if (this.hasFaCC()) {
      return this.props.children({ camera: this, status: this.getStatus() });
    }
    return this.props.children;
  };

  render() {
    const nativeProps = this._convertNativeProps(this.props);

    if (this.state.isAuthorized || this.hasFaCC()) {
      return (
        <RNCamera
          {...nativeProps}
          style={StyleSheet.absoluteFill}
          ref={this._setReference}
          onMountError={this._onMountError}
          onCameraReady={this._onCameraReady}
          onAudioInterrupted={this._onAudioInterrupted}
          onAudioConnected={this._onAudioConnected}
          onGoogleVisionBarcodesDetected={this._onObjectDetected(
            this.props.onGoogleVisionBarcodesDetected,
          )}
          onBarCodeRead={this._onObjectDetected(this.props.onBarCodeRead)}
          onTouch={this._onTouch}
          onFacesDetected={this._onObjectDetected(this.props.onFacesDetected)}
          onTextRecognized={this._onObjectDetected(this.props.onTextRecognized)}
          onPictureSaved={this._onPictureSaved}
          onSubjectAreaChanged={this._onSubjectAreaChanged}
        >
          {this.renderChildren()}
        </RNCamera>
      );
    } else if (!this.state.isAuthorizationChecked) {
      return this.props.pendingAuthorizationView;
    } else {
      return this.props.notAuthorizedView;
    }
  }

  _convertNativeProps(props: PropsType) {
    const newProps = mapValues(props, this._convertProp);

    if (props.onBarCodeRead) {
      newProps.barCodeScannerEnabled = true;
    }

    if (props.onGoogleVisionBarcodesDetected) {
      newProps.googleVisionBarcodeDetectorEnabled = true;
    }

    if (props.onFacesDetected) {
      newProps.faceDetectorEnabled = true;
    }

    if (props.onTap || props.onDoubleTap) {
      newProps.touchDetectorEnabled = true;
    }

    if (props.onTextRecognized) {
      newProps.textRecognizerEnabled = true;
    }

    if (Platform.OS === 'ios') {
      delete newProps.ratio;
    }

    return newProps;
  }

  _convertProp(value: *, key: string): * {
    if (typeof value === 'string' && Camera.ConversionTables[key]) {
      return Camera.ConversionTables[key][value];
    }

    return value;
  }
}

export const Constants = Camera.Constants;

const RNCamera = requireNativeComponent('RNCamera', Camera, {
  nativeOnly: {
    accessibilityComponentType: true,
    accessibilityLabel: true,
    accessibilityLiveRegion: true,
    barCodeScannerEnabled: true,
    touchDetectorEnabled: true,
    googleVisionBarcodeDetectorEnabled: true,
    faceDetectorEnabled: true,
    textRecognizerEnabled: true,
    importantForAccessibility: true,
    onBarCodeRead: true,
    onGoogleVisionBarcodesDetected: true,
    onCameraReady: true,
    onAudioInterrupted: true,
    onAudioConnected: true,
    onPictureSaved: true,
    onFaceDetected: true,
    onTouch: true,
    onLayout: true,
    onMountError: true,
    onSubjectAreaChanged: true,
    renderToHardwareTextureAndroid: true,
    testID: true,
  },
});
