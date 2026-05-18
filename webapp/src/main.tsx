import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App.tsx'
import { startRadioMeshBridge } from './services/radioMeshBridge'
import './index.css'

startRadioMeshBridge();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
