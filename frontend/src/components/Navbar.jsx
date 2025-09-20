import { useEffect, useState } from "react";
import { FiGithub } from "react-icons/fi";

const Navbar = () => {
  const [user, setUser] = useState(null);
  const [pop, setPop] = useState(false);

  const handleLogin = async () => {
    window.location.href = "/api/auth/login";
  };

  useEffect(() => {
    const authenticate = async () => {
      const res = await fetch("/api/auth/login/success", {
        method: "GET",
        credentials: "include",
      });
      const data = await res.json();
      setUser(data.user);
    };
    authenticate();
  }, []);

  return (
    <div id='navbar'>
      <span id='logo'>Launchly</span>
      {user ? (
        <>
          <div id='pfp-btn' onClick={() => setPop((s) => !s)}>
            <img src={user.photos[0].value} alt='' id='pfp' />
            {user.displayName}
          </div>
          {pop ? (
            <div className='navpop'>
              <button className='repobtn'>Logout</button>
              <button className='repobtn'>Profile</button>
            </div>
          ) : null}
        </>
      ) : (
        <button className='login-btn' onClick={handleLogin}>
          <FiGithub size={24} />
          Login
        </button>
      )}
      <img src='navbg.jpg' alt='' className='herobg' />
    </div>
  );
};

export default Navbar;
