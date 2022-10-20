//board
let size = 25;
let baris = 20;
let colom = 20;
let board;
let context;

//validate the game
let win = false;
let gameOver = false;
let counter = 0;

//snake moves
let movingX = 0;
let movingY=0;

//random food color
let x = Math.random()*255;
let y = Math.random()*255;
let z = Math.random()*255;

let pop = document.getElementById("popUp");

//food
let foodX;
let foodY;

//snake head
let snakeX = size *5;
let snakeY = size *5;

//snake body
let body = [];


window.onload = function(){
    board = document.getElementById("board");
    board.height = baris * size;
    board.width = colom * size;
    //make the board
    context = board.getContext("2d");

    RandomFood();
    document.addEventListener("keyup", changeDirection);
    setInterval(update, 1000/6);
}

function update(){
    if(gameOver == true){
        return;
    }   

    if(win == true){
        alert("You have win this game");
        return;
    }
    
    if(counter == 400){
        win = true;
    }

    //make the board game
    context.fillStyle="#010110";
    context.fillRect(0, 0, board.height, board.height);

    //make the food color random
    context.fillStyle= `rgb(${x}, ${y}, ${z})`;
    context.shadowColor = `rgb(${x}, ${y}, ${z})`;
    context.shadowBlur = 15;
    context.fillRect(foodX, foodY, size, size);

    //if snake eat the food
    if(snakeX == foodX && snakeY == foodY){
        body.push([foodX, foodY]);
        RandomFood();
        counter++;
        RandomColor();
    }

    

    //the body will follow the head
    for(let i = body.length-1; i>0 ; i--){
        body[i] = body[i-1];
    }
    if(body.length){
        body[0]=[snakeX, snakeY];
    }

    //first head snake
    context.fillStyle="white";
    context.shadowColor = "white";
    context.shadowBlur = 20;
    snakeX += movingX * size;
    snakeY += movingY * size;
    context.fillRect(snakeX, snakeY, size, size);

    for(let i=0; i<= body.length-1; i++){
        if(foodX == body[i][0] && foodY == body[i][1]){
            RandomFood();
        }
    }

    //the body will follow the head;
    for(let i=0; i<= body.length-1; i++){
        context.fillRect(body[i][0], body[i][1], size, size);
    }

    //making not overflow for the snake with the board
    if(snakeX < 0 || snakeX >= colom*size || snakeY < 0 || snakeY >= baris*size){
        gameOver = true;
        pop.style.display = "block";
    }

    //making not eat snake body itself
    for(let i = 0; i < body.length; i++){
        if(snakeX == body[i][0] && snakeY== body[i][1]){
            gameOver = true;
            pop.style.display = "block";
        }
    }

    //show the score
    let score= document.getElementById("tes").innerHTML = `Your Score : ${counter}`;
}

//change direction
function changeDirection(e){
    if(e.code == "ArrowUp" && movingY!= 1){
        movingX = 0;
        movingY = -1;
    }
    if(e.code == "ArrowDown" && movingY!= -1){
        movingX = 0;
        movingY = 1;
    }
    if(e.code == "ArrowLeft" && movingX!= 1){
        movingX = -1;
        movingY = 0;
    }
    if(e.code == "ArrowRight" && movingX!= -1){
        movingX = 1;
        movingY = 0;
    }
}

//random food place
function RandomFood(){
    foodX = Math.floor(Math.random()*baris)*size;
    foodY = Math.floor(Math.random()*colom)*size;
}

//random food color
function RandomColor(){
    x = Math.random()*255;
    y = Math.random()*255;
    z = Math.random()*255;
}




