import { useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import Heropage from "./components/Heropage";
import Repos from "./components/Repos";
import { BrowserRouter, Route, Routes } from "react-router";
import Profile from "./components/Profile";

const App = () => {
  const [user, setUser] = useState(null);
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
    <BrowserRouter id='web'>
      <Navbar />
      <Routes>
        <Route path='/' element={<Heropage />} />
        <Route path='/repos' element={<Repos />} />
        <Route path="/profile" element={<Profile/>}/>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
