export const loadScripts = (urls: string[]): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    for (const url of urls) {
      await new Promise<void>((res, rej) => {
        if (document.querySelector(`script[src="${url}"]`)) {
          res();
          return;
        }
        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.crossOrigin = "anonymous";
        script.onload = () => res();
        script.onerror = () => rej(new Error(`Failed to load script: ${url}`));
        document.body.appendChild(script);
      });
    }
    resolve();
  });
};
