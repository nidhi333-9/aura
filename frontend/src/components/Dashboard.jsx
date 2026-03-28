import axios from "axios";
import { useEffect, useState } from "react";

const Dashboard = () => {
  const [userData, setUserData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get("http://localhost:8080/dashboard", {
          headers: {
            Authorization: localStorage.getItem("token"),
          },
        });
        setUserData(res.data);
        console.log(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await axios.get("http://localhost:8080/analytics", {
          headers: {
            Authorization: localStorage.getItem("token"),
          },
        });

        console.log("DATA:", res.data);
        setAnalytics(res.data);
      } catch (err) {
        console.error("ERROR:", err);
      }
    };

    fetchAnalytics();
  }, []);

  if (!analytics) return <p>Loading...</p>;
  return (
    <>
      <h1>DashBoard</h1>
      {userData && (
        <>
          <h2>Welcome 👋</h2>
          <p>User ID: {userData.id}</p>
        </>
      )}
      <p>Focus Score: {analytics.focus_score}%</p>
      <p>Current App: {analytics.current_app}</p>
      <p>Most Used: {analytics.most_used}</p>
    </>
  );
};

export default Dashboard;
