class App {
  constructor() {
    /** @type { Object.<string,HTMLElement> } */
    this.components
    this.registerProperties('originalImg')
  }

  start() {
    /** @type { { toast:(msg:string, timeout:number = 1000)=>Promise<any> } } */
    this.modal_ = this.components.modal.model
    if (!this.data?.b64Content?.length) {
      return
    }
    const b = Uint8Array.from(atob(this.data.b64Content), c => c.charCodeAt(0))
    const f = new File([b], this.data.name || 'img.png')
    this.originalImg = URL.createObjectURL(f)
  }
}
