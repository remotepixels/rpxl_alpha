////////////////////////////////////////////////////////////////////////////////////////////////////
//github authorization token, really shouldn't leave this lying around....
////////////////////////////////////////////////////////////////////////////////////////////////////
const headers = {
            "Authorization" : 'Token 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'
           }

////////////////////////////////////////////////////////////////////////////////////////////////////
//async function to create issue on github, used to save session ID's
////////////////////////////////////////////////////////////////////////////////////////////////////
async function addIssue(encodedSession) {
    const url = "https://api.github.com/repos/remotepixels/rpxl/issues";

    const data = {
        title: "SessionID",
        body: encodedSession
    }
    const response = await fetch(url, {
        "method": "POST",
        "headers": headers,
        "body": JSON.stringify(data)
    })
    const result = await response.json();
    console.log("Posted too github :", result);
}

////////////////////////////////////////////////////////////////////////////////////////////////////
//get session ID's from github issues
//date range to look for session id's in repo issues currently set to 30 day
////////////////////////////////////////////////////////////////////////////////////////////////////
const currentDate = new Date();
var backDate = new Date();
backDate.setDate(backDate.getDate() - 90);

//change date format to yyyy-mm-dd for search query
const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

currentDateyyyymmdd = (formatDate(currentDate));
backDateyyyymmdd = (formatDate(backDate));

