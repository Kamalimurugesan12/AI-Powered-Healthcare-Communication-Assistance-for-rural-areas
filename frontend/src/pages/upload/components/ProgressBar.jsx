function ProgressBar({ progress }) {
  return (
    <div className="mb-3">
      <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
        <div
          className="bg-primary h-3 rounded-full transition-all duration-200"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <p className="text-sm text-muted-foreground mt-1 text-center">{progress}%</p>
    </div>
  );
}

export default ProgressBar;