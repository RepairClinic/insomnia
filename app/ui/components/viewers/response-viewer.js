import React, {PropTypes, PureComponent} from 'react';
import iconv from 'iconv-lite';
import autobind from 'autobind-decorator';
import {shell} from 'electron';
import CodeEditor from '../codemirror/code-editor';
import ResponseWebView from './response-webview';
import ResponseRaw from './response-raw';
import ResponseError from './response-error';
import {LARGE_RESPONSE_MB, PREVIEW_MODE_FRIENDLY, PREVIEW_MODE_RAW} from '../../../common/constants';

let alwaysShowLargeResponses = false;

@autobind
class ResponseViewer extends PureComponent {
  constructor (props) {
    super(props);
    this.state = {
      blockingBecauseTooLarge: false
    };
  }

  _handleOpenLink (link) {
    shell.openExternal(link);
  }

  _handleDismissBlocker () {
    this.setState({blockingBecauseTooLarge: false});
  }

  _handleDisableBlocker () {
    alwaysShowLargeResponses = true;
    this._handleDismissBlocker();
  }

  _checkResponseBlocker (props) {
    if (alwaysShowLargeResponses) {
      return;
    }

    // Block the response if it's too large
    if (props.bytes > LARGE_RESPONSE_MB * 1024 * 1024) {
      this.setState({blockingBecauseTooLarge: true});
    }
  }

  componentWillMount () {
    this._checkResponseBlocker(this.props);
  }

  componentWillReceiveProps (nextProps) {
    this._checkResponseBlocker(nextProps);
  }

  shouldComponentUpdate (nextProps, nextState) {
    for (let k of Object.keys(nextProps)) {
      const value = nextProps[k];
      if (typeof value !== 'function' && this.props[k] !== value) {
        return true;
      }
    }

    for (let k of Object.keys(nextState)) {
      const value = nextState[k];
      if (typeof value !== 'function' && this.state[k] !== value) {
        return true;
      }
    }

    return false;
  }

  render () {
    const {
      previewMode,
      filter,
      contentType,
      editorLineWrapping,
      editorFontSize,
      editorIndentSize,
      editorKeyMap,
      updateFilter,
      statusCode,
      body: base64Body,
      encoding,
      url,
      error
    } = this.props;

    const bodyBuffer = new Buffer(base64Body, encoding);

    if (error) {
      return (
        <ResponseError
          url={url}
          error={bodyBuffer.toString('utf8')}
          fontSize={editorFontSize}
          statusCode={statusCode}
        />
      );
    }

    const {blockingBecauseTooLarge} = this.state;
    if (blockingBecauseTooLarge) {
      return (
        <div className="response-pane__notify">
          <p className="pad faint">
            Response body over {LARGE_RESPONSE_MB}MB hidden to prevent unresponsiveness
          </p>
          <p>
            <button onClick={this._handleDismissBlocker}
                    className="inline-block btn btn--clicky">
              Show Response
            </button>
            {' '}
            <button className="faint inline-block btn btn--super-compact"
                    onClick={this._handleDisableBlocker}>
              Always Show
            </button>
          </p>
        </div>
      );
    }

    if (bodyBuffer.length === 0) {
      return (
        <div className="pad faint">
          No body returned in response
        </div>
      );
    }

    const ct = contentType.toLowerCase();
    if (previewMode === PREVIEW_MODE_FRIENDLY && ct.indexOf('image/') === 0) {
      const justContentType = contentType.split(';')[0];
      return (
        <div className="scrollable-container tall wide">
          <div className="scrollable">
            <img src={`data:${justContentType};base64,${base64Body}`}
                 className="pad block"
                 style={{maxWidth: '100%', maxHeight: '100%', margin: 'auto'}}/>
          </div>
        </div>
      );
    } else if (previewMode === PREVIEW_MODE_FRIENDLY && ct.includes('html')) {
      const justContentType = contentType.split(';')[0];
      const match = contentType.match(/charset=([\w-]+)/);
      const charset = (match && match.length >= 2) ? match[1] : 'utf-8';
      return (
        <ResponseWebView
          body={iconv.decode(bodyBuffer, charset)}
          contentType={`${justContentType}; charset=UTF-8`}
          url={url}
        />
      );
    } else if (previewMode === PREVIEW_MODE_RAW) {
      const match = contentType.match(/charset=([\w-]+)/);
      const charset = (match && match.length >= 2) ? match[1] : 'utf-8';
      return (
        <ResponseRaw
          value={iconv.decode(bodyBuffer, charset)}
          fontSize={editorFontSize}
        />
      );
    } else { // Show everything else as "source"
      const match = contentType.match(/charset=([\w-]+)/);
      const charset = (match && match.length >= 2) ? match[1] : 'utf-8';
      const body = iconv.decode(bodyBuffer, charset);

      let mode = contentType;
      try {
        // FEATURE: Detect JSON even without content-type
        contentType.indexOf('json') === -1 && JSON.parse(body);
        mode = 'application/json';
      } catch (e) {
        // Nothing
      }

      return (
        <CodeEditor
          onClickLink={this._handleOpenLink}
          defaultValue={body}
          updateFilter={updateFilter}
          filter={filter}
          autoPrettify
          noMatchBrackets
          readOnly
          mode={mode}
          lineWrapping={editorLineWrapping}
          fontSize={editorFontSize}
          indentSize={editorIndentSize}
          keyMap={editorKeyMap}
          placeholder="..."
        />
      );
    }
  }
}

ResponseViewer.propTypes = {
  body: PropTypes.string.isRequired,
  encoding: PropTypes.string.isRequired,
  previewMode: PropTypes.string.isRequired,
  filter: PropTypes.string.isRequired,
  editorFontSize: PropTypes.number.isRequired,
  editorIndentSize: PropTypes.number.isRequired,
  editorKeyMap: PropTypes.string.isRequired,
  editorLineWrapping: PropTypes.bool.isRequired,
  url: PropTypes.string.isRequired,
  bytes: PropTypes.number.isRequired,
  statusCode: PropTypes.number.isRequired,
  responseId: PropTypes.string.isRequired,
  contentType: PropTypes.string.isRequired,

  // Optional
  updateFilter: PropTypes.func,
  error: PropTypes.bool
};

export default ResponseViewer;
