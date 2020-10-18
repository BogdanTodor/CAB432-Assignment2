window.onload = function () {
    var ctx = document.getElementById('myChart');

    console.log(ctx.dataset.series);
    ctxData = JSON.parse(ctx.dataset.series);
    let labelArray = ctxData[0];
    let negArray = ctxData[1];
    let neutralArray = ctxData[2];
    let posArray = ctxData[3];

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labelArray,
            datasets: [{
                    label: 'Negative (below -1)',
                    data: negArray,
                    backgroundColor: '#EBCCD1',
                },
                {
                    label: 'Neutral (-1 to +1)',
                    data: neutralArray,
                    backgroundColor: '#FAEBCC',
                },
                {
                    label: 'Positive (above +1)',
                    data: posArray,
                    backgroundColor: '#D6E9C6',
                }
            ],
        },
        options: {
            scales: {
                xAxes: [{
                    stacked: true
                }],
                yAxes: [{
                    stacked: true,
                    scaleLabel: {
                        display: true,
                        labelString: "Number of Tweets",
                    }
                }]
            }
        }

    });

    let ctx2 = document.getElementById('lineChart');

    console.log(ctx2.dataset.series);
    ctx2Data = JSON.parse(ctx2.dataset.series);
    let tagLabels = ctx2Data[0];
    let timestampLabels = ctx2Data[1];
    let historicalData = ctx2Data[2];

    // red, blue, green, pink, black, aqua, orange, yellow (repeated)
    backgroundColors =  ["#db1a1a", "#0232f2", "#2dd41e", "#ed0ede", "#000000", "#16ded4", "#ed900e", "#f0d802",
    "#db1a1a", "#0232f2", "#2dd41e", "#ed0ede", "#000000", "#16ded4", "#ed900e", "#f0d802",
    "#db1a1a", "#0232f2", "#2dd41e", "#ed0ede", "#000000", "#16ded4", "#ed900e", "#f0d802"];
    borderColors = ["#ff9e9e", "#c3c3eb", "#96ed8e", "#f075e7", "#454343", "#b8f5f2", "#f0c281", "#faf2a7",
    "#ff9e9e", "#c3c3eb", "#96ed8e", "#f075e7", "#454343", "#b8f5f2", "#f0c281", "#faf2a7",
    "#ff9e9e", "#c3c3eb", "#96ed8e", "#f075e7", "#454343", "#b8f5f2", "#f0c281", "#faf2a7"];

    // Format datasets for graph
    historicalDatasets = [];
    for (let label of tagLabels) {
        let dataset = {
            label : label,
            data : historicalData[tagLabels.indexOf(label)],
            backgroundColor: backgroundColors[tagLabels.indexOf(label)],
            borderColor: borderColors[tagLabels.indexOf(label)],
            fill: false,
            lineTension: 0,
            radius: 3
        }
        historicalDatasets.push(dataset)
    }

    // Convert timestamp labels from milliseconds to locale date string
    if (timestampLabels) {
        for (let i = 0; i < timestampLabels.length ; i++) {
            timestampLabels[i] = new Date(timestampLabels[i]);
            timestampLabels[i] = timestampLabels[i].toLocaleString();
            console.log(timestampLabels[i]);
        }
    }

    new Chart(ctx2, {
        type: 'line',
        data: {
            labels: timestampLabels,
            datasets: historicalDatasets,
            backgroundColor: ["red", "blue", "green", "blue", "red", "blue"], 
        },
        options: {
            scales: {
                yAxes: [{
                    stacked: true,
                    scaleLabel: {
                        display: true,
                        labelString: "Average Sentiment Score",
                    }
                }]
            }
        }
    });

}