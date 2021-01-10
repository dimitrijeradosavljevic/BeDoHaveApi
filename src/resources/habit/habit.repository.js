import { HABIT_TAG, neo4j, USER_HABIT} from "../../utils/db";


export const getHabits = async (session, userId, perPage, page) => {
  return session.readTransaction(async txc => {
    const result = await txc.run(
      `MATCH (user:User)-[:${USER_HABIT}]->(habit:Habit) ` +
      'WHERE ID(user) = $userId ' +
      'WITH collect(habit) as habits, count(habit) as total ' +
      'UNWIND habits as habit ' +
      'RETURN habit, total ' +
      'ORDER BY habit.name DESC ' +
      'SKIP $skip ' +
      'LIMIT $limit',
      {
        userId: neo4j.int(userId),
        skip: neo4j.int((page - 1) * perPage),
        limit: neo4j.int(perPage),
      })


    if (result.records.length == 0) {
      return {habits: new Array, total: 0}
    }

    const habits = result.records.map(record => {
      const habit = record.get('habit')

      return {
        ...habit.properties,
        id: habit.identity.toString()
      }
    })

    const total = parseInt(result.records[0].get('total').toString())
    return { habits, total }
  });
}



export const getHabit = async (session, habitId) => {
  return session.readTransaction(async txc => {
    const result = await txc.run(
      'MATCH (habit:Habit) ' +
      'WHERE ID(habit) = $habitId ' +
      `OPTIONAL MATCH (habit)-[:${HABIT_TAG}]->(tag:Tag) ` +
      'WITH habit, collect(tag) as tags ' +
      'RETURN habit, tags',
      {
        habitId: neo4j.int(habitId)
      })


    if (result.records.length == 0) {
      return null
    }


    const habit = result.records[0].get('habit')
    const tags = result.records[0].get('tags').map(tag => {
      return {
        ...tag.properties,
        id: tag.identity.toString()
      }
    })

    return {
      ...habit.properties,
      id: habit.identity.toString(),
      tags
    }
  });
}


export const postHabit = async (session, userId, habit) => {

  habit.date = new Date()

  return session.writeTransaction(async txc => {
    const result = await txc.run(
      'CREATE (habit:Habit { ' +
          'name: $name, ' +
          'description: $description, ' +
          'frequency: $frequency, ' +
          'frequencySpecific: $frequencySpecific }) ' +
          // 'date: date($date) }) ' +
          // 'date: date({year: $dateYear, month: $dateMonth, day: $dateDay}) }) ' +
      'RETURN habit',
      {
        name: habit.name,
        description: habit.description,
        frequency: habit.frequency,
        frequencySpecific: habit.frequencySpecific
      }
    )

    if (result.records.length == 0) {
      // TODO handle error
    }

    const habitResult = result.records[0].get('habit')

    const habitRelationship = await txc.run(
      'MATCH (user:User), (habit:Habit) ' +
      'WHERE ID(user) = $userId and ID(habit) = $habitId ' +
      `CREATE (user)-[relationship:${USER_HABIT}]->(habit) ` +
      'RETURN relationship',
      {
        userId: neo4j.int(userId),
        habitId: (habitResult.identity)
      }
    );

    if (habitRelationship.records.length == 0) {
      // TODO handle error
    }

    habit.tags.map(async tag => {
      const relationship = await txc.run(
        'MATCH (habit:Habit), (tag:Tag) ' +
        'WHERE ID(habit) = $habitId and ID(tag) = $tagId ' +
        `CREATE (habit)-[relationship:${HABIT_TAG}]->(tag) ` +
        'RETURN relationship',
        {
          habitId: habitResult.identity,
          tagId: neo4j.int(tag.id)
        }
      )
      if(relationship.recordslength == 0) {
        return null
      }
    })

    return {...habitResult.properties, id: habitResult.identity.toString()}
  });
}


export const putHabit = async (session, habit) => {
  return session.writeTransaction(async txc => {
    const habitResult = await txc.run(
      'MATCH (habit:Habit) ' +
      'WHERE ID(habit) = $habitId ' +
      'SET habit.name = $name ' +
      'RETURN habit',
      {
        habitId: neo4j.int(habit.id),
        name: habit.name,
      }
    );

    if (habitResult.records.length == 0) {
      // TODO (handle error)
    }

    const r = await txc.run(
      `MATCH (habit:Habit)-[relationship:${HABIT_TAG}]->(:Tag) ` +
      'WHERE ID(habit) = $habitId ' +
      'DELETE relationship ',
      {
        habitId: neo4j.int(habit.id),
        name: habit.name,
      }
    );

    habit.tags.map(async tag => {
      const relationship = await txc.run(
        'MATCH (habit:Habit), (tag:Tag) ' +
        'WHERE ID(habit) = $habitId and ID(tag) = $tagId ' +
        `CREATE (habit)-[relationship:${HABIT_TAG}]->(tag) ` +
        'RETURN relationship',
        {
          habitId: habitResult.identity,
          tagId: neo4j.int(tag.id)
        }
      )
      if(relationship.recordslength == 0) {
        return null
      }
    })

    const habitUpdated = habitResult.records[0].get('habit')
    return {...habitUpdated.properties, id: habitUpdated.identity.toString()}
  });
}


export const deleteHabit = async (session, habitId) => {

  return session.writeTransaction(async txc => {
    const result = await txc.run(
      'MATCH (habit:Habit) ' +
      'WHERE ID(habit) = $habitId ' +
      'DETACH DELETE habit',
      {
        habitId: neo4j.int(habitId)
      }
    );

    console.log(result)
    // TODO (check result object when deleting node)
  });
}

