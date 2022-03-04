export default class DeferredEvent<T> {
    public promise: Promise<T>
    public resolve: (result: T) => void
    public reject: (err: any) => void

    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.reject = reject
            this.resolve = resolve
        })
    }
}