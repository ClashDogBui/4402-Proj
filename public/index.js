const buttonTest = document.querySelector("#btn");
const output = document.querySelector("#out");


buttonTest.addEventListener("click", async (e)=> {
  const res = await fetch('/api/hello');
  const data = await res.json();
  output.textContent =data.message;
});

