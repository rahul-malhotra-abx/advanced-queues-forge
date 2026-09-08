import {Injectable} from '@angular/core';
import Channel from 'iframe-channel';
import {ENVIRONMENT} from "../environment";

export class FrameWrapper {
  protected channel;
  protected listeners = {};

  constructor(protected iframeDom, protected childFrameOrigin) {
    this.channel = new Channel({
      targetOrigin: '*',
      target: this.iframeDom && this.iframeDom.contentWindow
    })
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.channel.connect().then(() => {
        this.channel.subscribe('event', (type, args) => {
          const callback = this.listeners[args.data.event];
          if (callback) {
            callback(args.data.data);
          }
        });
        resolve(this.channel);
      })
    })
  }

  async postMessage(type: string, message: any) {
    return this.channel.postMessage(type, message);
  }

  async setProps(props: any = {}) {
    return await this.postMessage('data', props);
  }

  async listen(event: string, callback: (...args) => void) {
    await this.postMessage('listen', {event});
    this.listeners[event] = callback;
  }

  async getProps() {
    return await this.postMessage('action', {action: 'getProps'});
  }
}
