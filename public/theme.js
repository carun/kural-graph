// Resolve the theme before first paint (no flash): a pinned choice wins, otherwise follow the system.
// A file rather than an inline script because public/_headers blocks inline scripts.
try{var p=localStorage.getItem('gitaviswa:theme');var t=p==='light'||p==='dark'?p:(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.dataset.theme=t}catch(e){}
