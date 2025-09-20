import React, { useEffect, useState } from "react";
import { redirect } from "react-router";

const Repos = () => {
  const [repos, setRepos] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const handleUser = async () => {
      const res = await fetch("/api/auth/login/success", {
        method: "GET",
        credentials: "include",
      });
      const data = await res.json();
      setUser(data.user);
    };
    handleUser();
    if (!user) redirect("/");
    const fetchRepos = async () => {
      try {
        const res = await fetch("/api/repos", {
          method: "GET",
          credentials: "include",
        });
        const data = await res.json();
        setRepos(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchRepos();
  }, []);

  const handleDeploy = async (repo) => {
    const gitUrl = repo.svn_url;
    const projectID = repo.name;
    const res = await fetch("/api/deploy", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ gitUrl, projectID }),
    });
    const data = await res.json();
    console.log(data);
  };

  return (
    <div className='herobody'>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className='hbody' style={{ gap: 10 }}>
          <span style={{ fontWeight: 600, fontSize: 22 }}>
            Your Repositories
          </span>
          <div className='repos'>
            {repos.map((repo) => (
              <div
                key={repo.id}
                className='repocard'
                style={{ position: "relative" }}
              >
                <span className='reponame'>{repo.name}</span>
                <span className='reposub'>
                  Created at: {new Date(repo.created_at).toLocaleDateString()}
                </span>
                <span className='reposub'>
                  Pushed at: {new Date(repo.pushed_at).toLocaleDateString()}
                </span>
                <div className='repobtns'>
                  <a className='repobtn' href={repo.clone_url} target='_blank'>
                    View Repo
                  </a>
                  <button
                    onClick={() => handleDeploy(repo)}
                    className='repobtn'
                  >
                    Deploy
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Repos;
