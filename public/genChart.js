window.onload = function () {
    var ctx = document.getElementById('myChart');

    console.log(ctx.dataset.series);
    dataObj = JSON.parse(ctx.dataset.series);

    let labelArray = dataObj[0];
    let negArray = dataObj[1];
    let neutralArray = dataObj[2];
    let posArray = dataObj[3];

    var myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labelArray,
            datasets: [{
                    label: 'Negative',
                    data: negArray,
                    backgroundColor: '#D6E9C6',
                },
                {
                    label: 'Neutral',
                    data: neutralArray,
                    backgroundColor: '#FAEBCC',
                },
                {
                    label: 'Positive',
                    data: posArray,
                    backgroundColor: '#EBCCD1',
                }
            ],
        }, // this data object can be created in index.js
        // ideally what happens is 4 arrays get created and the data above is represented by that
        options: {
            scales: {
                xAxes: [{
                    stacked: true
                }],
                yAxes: [{
                    stacked: true
                }]
            }
        }

    });


    // All of the below is dummy data atm
    var ctx2 = document.getElementById('lineChart');

    var myLineChart = new Chart(ctx2, {
        type: 'line',
        data: {
            labels: ["match1", "match2", "match3", "match4", "match5"], //labels would be
            datasets: [{
                    label: "TeamA Score",
                    data: [10, 50, 25, 70, 40], // historical data
                    backgroundColor: "blue",
                    borderColor: "lightblue",
                    fill: false,
                    lineTension: 0,
                    radius: 5
                },
                { // may have to generate each of the below for each tag or tweet(can become cumbersome)
                    label: "TeamB Score",
                    data: [20, 35, 40, 60, 50], // historical data
                    backgroundColor: "green",
                    borderColor: "lightgreen",
                    fill: false,
                    lineTension: 0,
                    radius: 5
                }
            ]
        },
        options: {
            scales: {
                yAxes: [{
                    stacked: true
                }]
            }
        }
    });

}