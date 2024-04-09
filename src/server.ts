import loaders from "./loaders";
import { connect } from "./api/models";

connect().then(async loaded => {
    if (loaded) {
        loaders();
        console.log("testing....")
    } else {
        console.log('Connection to MongoDB failed', loaded);
    }
})
// export default loaders();
