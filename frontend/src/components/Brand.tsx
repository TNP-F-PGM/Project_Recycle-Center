// Shared branding for the welcome page and application sidebar.
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-symbol">
        <img src={`${import.meta.env.BASE_URL}icons/Logo.png`} alt="" width={44} height={44} />
      </span>
      <div>
        <strong>RecycleHub</strong>
        <small>Recycling center</small>
      </div>
    </div>
  )
}
