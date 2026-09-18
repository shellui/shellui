declare module '*?worker&module' {
  const workerConstructor: {
    new (): Worker;
  };
  export default workerConstructor;
}
