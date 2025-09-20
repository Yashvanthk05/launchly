import { useEffect, useState } from "react";

const Profile = () => {
  const [user, setUser] = useState(null);
  useEffect(() => {
    const authenticate = async () => {
      const res = await fetch("/api/auth/login/success");
      const data = await res.json();
      setUser(data.user);
      console.log(data.user);
    };
    authenticate();
  }, []);
  return (
    <div>
      Profile
      <img src={user?.photos[0].value} alt="pfp" />
      <span>{user?.displayName}</span>
      <span>{user?.username}</span>

    </div>
  );
};

export default Profile;
