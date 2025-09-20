import { DiGithubFull } from "react-icons/di";
import { FaAws } from "react-icons/fa";
import { SiExpress, SiRocket, SiVercel } from "react-icons/si";
import { IoIosRocket } from "react-icons/io";
import { useEffect, useState } from "react";
import { redirect, useNavigate } from "react-router";

const Heropage = () => {
  const [user, setUser] = useState(false);
  let navigate = useNavigate();

  useEffect(() => {
    const authenticate = async () => {
      const res = await fetch("/api/auth/login/success", {
        method: "GET",
        credentials: "include",
      });
      const data = await res.json();
      setUser(data.success);
    };
    authenticate();
  }, []);

  const handleLogin = async () => {
    if (!user) window.location.href = "/api/auth/login";
    else navigate("/repos");
  };

  return (
    <div className='herobody'>
      <div className='hbody'>
        <span className='con1'>Build and Deploy on Launchly</span>
        <span className='con1'>
          An Inspiration of <SiVercel />
        </span>
        <span className='con2'>
          Launchly is Software Engineered Application to build and deploy static
          websites using AWS S3, EC2 and proxy serve in Launchly subdomains.
        </span>
        <span className='logos'>
          Techstack:
          <DiGithubFull size={60} />
          <FaAws size={40} />
          <SiExpress size={30} />
        </span>
        <button className='login-btn' onClick={handleLogin}>
          Build and Deploy
          <IoIosRocket size={24} />
        </button>
      </div>
      <img src='herobg.jpg' alt='' className='herobg' />
    </div>
  );
};

export default Heropage;
