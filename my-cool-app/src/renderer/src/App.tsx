function App(): React.JSX.Element {
  return (
    <div data-theme="synthwave" className="min-h-screen w-full flex flex-col items-center justify-center gap-6 p-8">
      
      <h1 className="text-5xl font-bold text-primary tracking-widest uppercase">
        DropBeam
      </h1>
      <p className="text-secondary text-sm tracking-widest">
        Local file transfer. No cloud. No nonsense.
      </p>

      <div className="flex gap-4 mt-4">
        <button className="btn btn-primary btn-lg">Send a File</button>
        <button className="btn btn-outline btn-secondary btn-lg">Receive</button>
      </div>

    </div>
  )
}

export default App